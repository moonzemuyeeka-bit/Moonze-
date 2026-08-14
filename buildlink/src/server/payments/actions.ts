"use server";

import { revalidatePath } from "next/cache";
import type { PaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth/guards";
import { isAdminRole } from "@/lib/auth/permissions";
import { loadOrderForActor } from "@/server/orders/service";
import {
  applyPaymentStatus,
  createPayment,
  loadPaymentForActor,
  markOrderAwaitingConfirmation,
  recordRefund,
} from "@/server/payments/service";
import { summarisePayments } from "@/lib/domain/payment-status";
import { getPaymentProvider } from "@/lib/services/payments";
import type { SandboxPaymentProvider } from "@/lib/services/payments/sandbox";
import { ANALYTICS_EVENTS, track } from "@/lib/services/analytics";
import { notify } from "@/lib/services/notifications";
import { enforceRateLimit } from "@/lib/rate-limit";
import { formatZmw } from "@/lib/money";
import { env } from "@/lib/env";
import {
  actionFailure,
  actionSuccess,
  AuthorisationError,
  ConfigurationError,
  ConflictError,
  toActionError,
  ValidationError,
  type ActionResult,
} from "@/lib/errors";
import { fieldErrorsFrom, formDataToObject } from "@/lib/validation/shared";
import {
  confirmPaymentSchema,
  initiatePaymentSchema,
  recordPaymentSchema,
  refundPaymentSchema,
  rejectPaymentSchema,
  sandboxSettleSchema,
  verifyPaymentSchema,
} from "@/lib/validation/checkout";

/**
 * Payment mutations.
 *
 * The honest shape of payments on BuildLink:
 *
 *  * A customer can **record** money they paid the supplier directly. That
 *    creates a PENDING payment which only the supplier (or an admin) can confirm
 *    arrived. Nobody can mark their own payment successful.
 *  * Where a provider is configured, a customer can **initiate** a payment the
 *    provider processes and confirms. With no provider configured, that path is
 *    unavailable and says so rather than pretending.
 *
 * BuildLink never holds the funds in either case.
 */

export type PaymentActionState = ActionResult<{ paymentId: string; status: PaymentStatus }> | null;

/**
 * Customer records a payment made outside BuildLink (cash, bank transfer, their
 * own mobile money).
 */
export async function recordPaymentAction(
  _previous: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  try {
    const user = await requireUser();
    await enforceRateLimit("mutation", user.id);

    const parsed = recordPaymentSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check the payment details.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }
    const input = parsed.data;

    const order = await loadOrderForActor(input.orderId, user);
    if (order.customerId !== user.id && !isAdminRole(user.role)) {
      throw new AuthorisationError("Only the customer can record a payment on this order.");
    }
    await assertPayableOrder(order.id, input.amountMinor);

    const payment = await createPayment({
      orderId: order.id,
      projectId: order.projectId,
      customerId: order.customerId,
      supplierId: order.supplierId,
      method: input.method,
      amountMinor: input.amountMinor,
      status: "PENDING",
      reference: input.reference ?? null,
      note: input.note ?? null,
      actor: user,
    });

    await markOrderAwaitingConfirmation(order.id, user);

    const created = await loadPaymentForActor(payment.id, user);
    await notifySupplierOfRecordedPayment(created, user);

    await track({
      name: ANALYTICS_EVENTS.paymentInitiated,
      userId: user.id,
      properties: { method: input.method, amountMinor: input.amountMinor, offline: true },
    });

    revalidateOrderPayments(order.id);
    return actionSuccess({ paymentId: payment.id, status: "PENDING" as PaymentStatus });
  } catch (error) {
    return toActionError(error, "recordPaymentAction");
  }
}

/**
 * Starts a provider-processed payment. The provider decides the outcome; this
 * action only records what it said.
 */
export async function initiatePaymentAction(
  _previous: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  try {
    const user = await requireUser();
    await enforceRateLimit("mutation", user.id);

    const parsed = initiatePaymentSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check the amount.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }

    const provider = await getPaymentProvider();
    if (!provider) {
      throw new ConfigurationError(
        "Online payment is not enabled on BuildLink yet. Pay your supplier directly and record the payment here.",
      );
    }

    const order = await loadOrderForActor(parsed.data.orderId, user);
    if (order.customerId !== user.id) {
      throw new AuthorisationError("Only the customer can pay for this order.");
    }
    await assertPayableOrder(order.id, parsed.data.amountMinor);

    const method = provider.supportedMethods[0];
    if (!method) {
      throw new ConfigurationError("The configured payment provider supports no payment methods.");
    }

    const payment = await createPayment({
      orderId: order.id,
      projectId: order.projectId,
      customerId: order.customerId,
      supplierId: order.supplierId,
      method,
      amountMinor: parsed.data.amountMinor,
      status: "INITIATED",
      provider: provider.name,
      actor: user,
    });

    const customer = await db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { name: true, phone: true },
    });

    const result = await provider.initiate({
      paymentId: payment.id,
      reference: payment.reference,
      amountMinor: parsed.data.amountMinor,
      method,
      customerName: customer.name,
      customerPhone: customer.phone,
      description: `BuildLink order ${order.orderNumber}`,
      returnUrl: `${env.APP_URL}/orders/${order.id}`,
    });

    const loaded = await loadPaymentForActor(payment.id, user);
    if (result.status !== "INITIATED") {
      await applyPaymentStatus({
        payment: loaded,
        to: result.status,
        actor: user,
        providerReference: result.providerReference,
        metadata: { provider: provider.name, instructions: result.instructions ?? null },
      });
    }

    await markOrderAwaitingConfirmation(order.id, user);

    await track({
      name: ANALYTICS_EVENTS.paymentInitiated,
      userId: user.id,
      properties: {
        method,
        amountMinor: parsed.data.amountMinor,
        provider: provider.name,
        sandbox: provider.isSandbox,
      },
    });

    revalidateOrderPayments(order.id);
    return actionSuccess({ paymentId: payment.id, status: result.status });
  } catch (error) {
    return toActionError(error, "initiatePaymentAction");
  }
}

/** Supplier (or admin) confirms an offline payment actually arrived. */
export async function confirmPaymentAction(
  _previous: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  try {
    const user = await requireUser();
    await enforceRateLimit("mutation", user.id);

    const parsed = confirmPaymentSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure("That payment is not valid.", "VALIDATION_ERROR");
    }

    const payment = await loadPaymentForActor(parsed.data.paymentId, user);
    assertCanConfirm(payment.supplierUserId, user.id, user.role);

    await applyPaymentStatus({
      payment,
      to: "SUCCESSFUL",
      actor: user,
      note: parsed.data.note ?? "Supplier confirmed the funds arrived.",
      metadata: { confirmedBy: user.role },
    });

    await track({
      name: ANALYTICS_EVENTS.paymentCompleted,
      userId: payment.customerId,
      properties: { method: payment.method, amountMinor: payment.amountMinor, manual: true },
    });

    if (payment.orderId) revalidateOrderPayments(payment.orderId);
    return actionSuccess({ paymentId: payment.id, status: "SUCCESSFUL" as PaymentStatus });
  } catch (error) {
    return toActionError(error, "confirmPaymentAction");
  }
}

/** Supplier (or admin) says the money never arrived. */
export async function rejectPaymentAction(
  _previous: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  try {
    const user = await requireUser();
    await enforceRateLimit("mutation", user.id);

    const parsed = rejectPaymentSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please say why the payment could not be confirmed.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }

    const payment = await loadPaymentForActor(parsed.data.paymentId, user);
    assertCanConfirm(payment.supplierUserId, user.id, user.role);

    await applyPaymentStatus({
      payment,
      to: "FAILED",
      actor: user,
      failureReason: parsed.data.reason,
      note: parsed.data.reason,
    });

    if (payment.orderId) revalidateOrderPayments(payment.orderId);
    return actionSuccess({ paymentId: payment.id, status: "FAILED" as PaymentStatus });
  } catch (error) {
    return toActionError(error, "rejectPaymentAction");
  }
}

/**
 * Asks the provider again what happened — the "I have approved it on my phone"
 * button. The provider's answer is authoritative; BuildLink never guesses.
 */
export async function verifyPaymentAction(
  _previous: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  try {
    const user = await requireUser();
    await enforceRateLimit("mutation", user.id);

    const parsed = verifyPaymentSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return actionFailure("That payment is not valid.", "VALIDATION_ERROR");

    const payment = await loadPaymentForActor(parsed.data.paymentId, user);
    if (!payment.providerReference) {
      throw new ConflictError("This payment was not processed by a provider, so there is nothing to check.");
    }

    const provider = await getPaymentProvider();
    if (!provider) {
      throw new ConfigurationError("No payment provider is configured on this deployment.");
    }

    const result = await provider.verify(payment.providerReference);
    if (result.status === payment.status) {
      return actionSuccess({ paymentId: payment.id, status: payment.status });
    }

    await applyPaymentStatus({
      payment,
      to: result.status,
      actor: user,
      providerReference: result.providerReference,
      metadata: result.metadata,
      failureReason: result.failureReason ?? null,
    });

    if (result.status === "SUCCESSFUL") {
      await track({
        name: ANALYTICS_EVENTS.paymentCompleted,
        userId: payment.customerId,
        properties: { method: payment.method, amountMinor: payment.amountMinor, manual: false },
      });
    }

    if (payment.orderId) revalidateOrderPayments(payment.orderId);
    return actionSuccess({ paymentId: payment.id, status: result.status });
  } catch (error) {
    return toActionError(error, "verifyPaymentAction");
  }
}

/**
 * Sandbox-only: stands in for the customer's handset approving or declining.
 *
 * Guarded twice — the provider must be the sandbox, and the sandbox itself
 * refuses to load in production unless explicitly allowed.
 */
export async function settleSandboxPaymentAction(
  _previous: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  try {
    const user = await requireUser();
    await enforceRateLimit("mutation", user.id);

    const parsed = sandboxSettleSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return actionFailure("That sandbox action is not valid.", "VALIDATION_ERROR");

    const provider = await getPaymentProvider();
    if (!provider || !provider.isSandbox) {
      throw new ConfigurationError("Sandbox payment controls are not available on this deployment.");
    }

    const payment = await loadPaymentForActor(parsed.data.paymentId, user);
    if (payment.customerId !== user.id && !isAdminRole(user.role)) {
      throw new AuthorisationError("Only the customer can approve their own payment.");
    }
    if (!payment.providerReference) {
      throw new ConflictError("This payment has no provider reference to settle.");
    }

    const sandbox = provider as SandboxPaymentProvider;
    const settledReference = sandbox.settle(payment.providerReference, parsed.data.outcome);
    const result = await sandbox.verify(settledReference);

    await applyPaymentStatus({
      payment,
      to: result.status,
      actor: user,
      providerReference: settledReference,
      metadata: result.metadata,
      failureReason: result.failureReason ?? null,
    });

    if (payment.orderId) revalidateOrderPayments(payment.orderId);
    return actionSuccess({ paymentId: payment.id, status: result.status });
  } catch (error) {
    return toActionError(error, "settleSandboxPaymentAction");
  }
}

/** Admin records that a supplier refunded a customer. */
export async function recordRefundAction(
  _previous: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  try {
    const admin = await requireAdmin();

    const parsed = refundPaymentSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please say why the refund is being recorded.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }

    const payment = await loadPaymentForActor(parsed.data.paymentId, admin);
    await recordRefund({ payment, actor: admin, reason: parsed.data.reason });

    if (payment.orderId) revalidateOrderPayments(payment.orderId);
    revalidatePath("/admin/payments");
    return actionSuccess({ paymentId: payment.id, status: "REFUNDED" as PaymentStatus });
  } catch (error) {
    return toActionError(error, "recordRefundAction");
  }
}

// ---------------------------------------------------------------------------
// Shared checks
// ---------------------------------------------------------------------------

/**
 * A payment must belong to a live order and cannot take the order past its
 * total: over-payment is nearly always a typo, and BuildLink holds no float to
 * absorb one.
 */
async function assertPayableOrder(orderId: string, amountMinor: number): Promise<void> {
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      status: true,
      totalMinor: true,
      payments: { select: { status: true, amountMinor: true } },
    },
  });

  if (["CANCELLED", "REFUNDED", "COMPLETED"].includes(order.status)) {
    throw new ConflictError("This order is closed, so no further payment can be recorded against it.");
  }

  const summary = summarisePayments(order.payments, order.totalMinor);
  const room = order.totalMinor - summary.settledMinor - summary.pendingMinor;
  if (amountMinor > room) {
    throw new ValidationError(
      room <= 0
        ? "This order is already fully paid or has a payment awaiting confirmation."
        : `That is more than the ${formatZmw(room)} still outstanding on this order.`,
      { amountMinor: [`Enter ${formatZmw(room)} or less.`] },
    );
  }
}

function assertCanConfirm(
  supplierUserId: string | null,
  actorId: string,
  actorRole: Parameters<typeof isAdminRole>[0],
): void {
  if (supplierUserId === actorId) return;
  if (isAdminRole(actorRole)) return;
  throw new AuthorisationError(
    "Only the supplier who is owed the money, or a BuildLink administrator, can confirm it arrived.",
  );
}

async function notifySupplierOfRecordedPayment(
  payment: Awaited<ReturnType<typeof loadPaymentForActor>>,
  actor: Awaited<ReturnType<typeof requireUser>>,
): Promise<void> {
  if (!payment.supplierUserId || payment.supplierUserId === actor.id) return;

  await notify({
    userId: payment.supplierUserId,
    type: "PAYMENT_RECEIVED",
    title: `${actor.name} recorded a payment of ${formatZmw(payment.amountMinor)}`,
    body: payment.orderNumber
      ? `Check whether the money for order ${payment.orderNumber} has reached you, then confirm or reject it.`
      : "Check whether the money has reached you, then confirm or reject it.",
    linkUrl: payment.orderId ? `/supplier/orders/${payment.orderId}` : "/supplier/orders",
  });
}

function revalidateOrderPayments(orderId: string): void {
  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/supplier/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/supplier/orders");
}
