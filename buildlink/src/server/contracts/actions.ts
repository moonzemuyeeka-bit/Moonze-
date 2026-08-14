"use server";

import { revalidatePath } from "next/cache";
import type { ContractStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { isAdminRole } from "@/lib/auth/permissions";
import { requestFingerprint } from "@/lib/auth/session";
import { loadContractForActor } from "@/server/contracts/service";
import { applyOrderStatus, loadOrderForActor } from "@/server/orders/service";
import {
  assertContractTransition,
  canRespondToContract,
  counterpartyOf,
} from "@/lib/domain/contract-status";
import { canTransitionOrder } from "@/lib/domain/order-status";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { notify } from "@/lib/services/notifications";
import { ANALYTICS_EVENTS, track } from "@/lib/services/analytics";
import { enforceRateLimit } from "@/lib/rate-limit";
import { formatZmw } from "@/lib/money";
import {
  actionFailure,
  actionSuccess,
  AuthorisationError,
  toActionError,
  type ActionResult,
} from "@/lib/errors";
import { fieldErrorsFrom, formDataToObject } from "@/lib/validation/shared";
import {
  cancelContractSchema,
  respondToContractSchema,
  sendContractSchema,
} from "@/lib/validation/checkout";

/**
 * Agreement lifecycle.
 *
 * A BuildLink agreement records what two parties agreed: items, prices, deposit,
 * balance, delivery and terms. Three rules make it worth having:
 *
 *  * Only the counterparty can accept — you cannot sign your own agreement.
 *  * Acceptance captures the typed name, the agreement *version*, the timestamp,
 *    the IP and the user agent, so an amended agreement can never inherit an
 *    earlier signature.
 *  * Accepting the agreement attached to an order is how a supplier accepts the
 *    order itself, and rejecting it cancels the order. One decision, not two.
 */

export type ContractActionState = ActionResult<{ status: ContractStatus }> | null;

export async function sendContractAction(
  _previous: ContractActionState,
  formData: FormData,
): Promise<ContractActionState> {
  try {
    const user = await requireUser();
    await enforceRateLimit("mutation", user.id);

    const parsed = sendContractSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return actionFailure("That agreement is not valid.", "VALIDATION_ERROR");

    const contract = await loadContractForActor(parsed.data.contractId, user);
    if (contract.actorRole !== contract.createdByRole && !isAdminRole(user.role)) {
      throw new AuthorisationError("Only the party who drew up this agreement can send it.");
    }
    assertContractTransition(contract.status, "SENT");

    const recipientRole = counterpartyOf(contract.createdByRole);
    const recipientUserId =
      recipientRole === "CUSTOMER" ? contract.customerId : contract.supplierUserId;

    await db.$transaction(async (tx) => {
      await tx.contract.update({
        where: { id: contract.id },
        data: { status: "SENT", sentAt: new Date() },
      });
      await recordAudit(
        {
          action: AUDIT_ACTIONS.contractSent,
          resourceType: "contract",
          resourceId: contract.id,
          actorUserId: user.id,
          actorRole: user.role,
          previousValue: { status: contract.status },
          newValue: { status: "SENT" },
        },
        tx,
      );
    });

    await notify({
      userId: recipientUserId,
      type: "CONTRACT_SENT",
      title: `Agreement ${contract.contractNumber} needs your response`,
      body: `${
        contract.createdByRole === "CUSTOMER" ? contract.customerName : contract.supplierName
      } has sent an agreement worth ${formatZmw(contract.totalMinor)}. Read it and accept or reject it.`,
      linkUrl: `/agreements/${contract.id}`,
    });

    await track({
      name: ANALYTICS_EVENTS.contractSent,
      userId: user.id,
      properties: { totalMinor: contract.totalMinor, createdBy: contract.createdByRole },
    });

    revalidateContract(contract.id);
    return actionSuccess({ status: "SENT" as ContractStatus });
  } catch (error) {
    return toActionError(error, "sendContractAction");
  }
}

/**
 * The counterparty accepts or rejects. Typing your own name is the signature,
 * and it is stored with everything needed to say who agreed to what, and when.
 */
export async function respondToContractAction(
  _previous: ContractActionState,
  formData: FormData,
): Promise<ContractActionState> {
  try {
    const user = await requireUser();
    await enforceRateLimit("mutation", user.id);

    const parsed = respondToContractSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please type your full name to record your decision.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }
    const input = parsed.data;

    const contract = await loadContractForActor(input.contractId, user);
    if (contract.actorRole === null) {
      throw new AuthorisationError(
        "Only the customer or the supplier named on this agreement can respond to it.",
      );
    }
    if (!canRespondToContract(contract.status, contract.actorRole, contract.createdByRole)) {
      throw new AuthorisationError(
        contract.status === "SENT"
          ? "You drew up this agreement, so the other party is the one who accepts it."
          : "This agreement is not awaiting a response.",
      );
    }

    const accepted = input.decision === "ACCEPT";
    const nextStatus: ContractStatus = accepted ? "ACCEPTED" : "REJECTED";
    assertContractTransition(contract.status, nextStatus);

    const { ipAddress, userAgent } = await requestFingerprint();

    await db.$transaction(async (tx) => {
      await tx.contract.update({
        where: { id: contract.id },
        data: { status: nextStatus, respondedAt: new Date() },
      });

      await tx.contractAcceptance.create({
        data: {
          contractId: contract.id,
          userId: user.id,
          role: contract.actorRole as "CUSTOMER" | "SUPPLIER",
          contractVersion: contract.version,
          accepted,
          signatureName: input.signatureName,
          ipAddress,
          userAgent,
        },
      });

      await recordAudit(
        {
          action: accepted ? AUDIT_ACTIONS.contractAccepted : AUDIT_ACTIONS.contractRejected,
          resourceType: "contract",
          resourceId: contract.id,
          actorUserId: user.id,
          actorRole: user.role,
          previousValue: { status: contract.status },
          newValue: {
            status: nextStatus,
            signatureName: input.signatureName,
            contractVersion: contract.version,
            reason: input.reason ?? null,
          },
        },
        tx,
      );
    });

    await syncOrderWithAgreement({
      contractOrderId: contract.orderId,
      accepted,
      reason: input.reason ?? null,
      user,
    });

    const otherPartyUserId =
      contract.actorRole === "CUSTOMER" ? contract.supplierUserId : contract.customerId;

    await notify({
      userId: otherPartyUserId,
      type: accepted ? "CONTRACT_ACCEPTED" : "CONTRACT_REJECTED",
      title: `Agreement ${contract.contractNumber} ${accepted ? "accepted" : "rejected"}`,
      body: accepted
        ? `${input.signatureName} accepted the agreement worth ${formatZmw(contract.totalMinor)}.`
        : `${input.signatureName} rejected the agreement.${input.reason ? ` Reason: ${input.reason}` : ""}`,
      linkUrl: `/agreements/${contract.id}`,
    });

    if (accepted) {
      await track({
        name: ANALYTICS_EVENTS.contractAccepted,
        userId: user.id,
        properties: { totalMinor: contract.totalMinor, acceptedBy: contract.actorRole },
      });
    }

    revalidateContract(contract.id);
    if (contract.orderId) revalidateOrder(contract.orderId);
    return actionSuccess({ status: nextStatus });
  } catch (error) {
    return toActionError(error, "respondToContractAction");
  }
}

export async function cancelContractAction(
  _previous: ContractActionState,
  formData: FormData,
): Promise<ContractActionState> {
  try {
    const user = await requireUser();
    await enforceRateLimit("mutation", user.id);

    const parsed = cancelContractSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please say why the agreement is being cancelled.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }

    const contract = await loadContractForActor(parsed.data.contractId, user);
    if (contract.actorRole === null && !isAdminRole(user.role)) {
      throw new AuthorisationError("Only a party to this agreement can cancel it.");
    }
    assertContractTransition(contract.status, "CANCELLED");

    await db.$transaction(async (tx) => {
      await tx.contract.update({
        where: { id: contract.id },
        data: { status: "CANCELLED", respondedAt: new Date() },
      });
      await recordAudit(
        {
          action: AUDIT_ACTIONS.contractCancelled,
          resourceType: "contract",
          resourceId: contract.id,
          actorUserId: user.id,
          actorRole: user.role,
          previousValue: { status: contract.status },
          newValue: { status: "CANCELLED", reason: parsed.data.reason },
        },
        tx,
      );
    });

    const otherPartyUserId =
      contract.actorRole === "CUSTOMER" ? contract.supplierUserId : contract.customerId;
    await notify({
      userId: otherPartyUserId,
      type: "CONTRACT_REJECTED",
      title: `Agreement ${contract.contractNumber} cancelled`,
      body: parsed.data.reason,
      linkUrl: `/agreements/${contract.id}`,
    });

    revalidateContract(contract.id);
    return actionSuccess({ status: "CANCELLED" as ContractStatus });
  } catch (error) {
    return toActionError(error, "cancelContractAction");
  }
}

/**
 * Keeps the order in step with the agreement attached to it.
 *
 * Accepting is the supplier saying "I can supply this", which is exactly what
 * CONFIRMED means; rejecting means the order is not happening. Both moves are
 * checked against the order state machine first, so an order that has already
 * moved on is left alone.
 */
async function syncOrderWithAgreement(input: {
  contractOrderId: string | null;
  accepted: boolean;
  reason: string | null;
  user: Awaited<ReturnType<typeof requireUser>>;
}): Promise<void> {
  if (!input.contractOrderId) return;

  const order = await loadOrderForActor(input.contractOrderId, input.user);
  const target = input.accepted ? "CONFIRMED" : "CANCELLED";
  if (!canTransitionOrder(order.status, target)) return;

  await applyOrderStatus({
    orderId: order.id,
    from: order.status,
    to: target,
    note: input.accepted
      ? "Supplier accepted the agreement for this order."
      : (input.reason ?? "Supplier rejected the agreement for this order."),
    actor: input.user,
    ...(input.accepted ? {} : { cancellationReason: input.reason ?? "Agreement rejected." }),
  });
}

function revalidateContract(contractId: string): void {
  revalidatePath(`/agreements/${contractId}`);
  revalidatePath("/customer/contracts");
  revalidatePath("/supplier/contracts");
}

function revalidateOrder(orderId: string): void {
  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/supplier/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/supplier/orders");
}
