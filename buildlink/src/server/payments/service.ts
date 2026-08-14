import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import type { PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/permissions";
import { assertPaymentTransition, requiresManualConfirmation } from "@/lib/domain/payment-status";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { notify } from "@/lib/services/notifications";
import { formatZmw } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { NotFoundError } from "@/lib/errors";

/**
 * Payment services.
 *
 * BuildLink is a **record keeper**, not a settlement rail. Two things follow from
 * that, and they are enforced here rather than trusted to callers:
 *
 *  * `SUCCESSFUL` is only ever reached because a provider said so, or because a
 *    named human confirmed the money arrived. Nothing optimistically succeeds.
 *  * Every status change appends an immutable `PaymentTransaction` row, so a
 *    disputed payment has a history rather than a single mutable status.
 *
 * Payment status deliberately does not move the order's status: a paid order is
 * still an order the supplier has to accept, and coupling the two would let one
 * state machine quietly drive the other. The single exception is at creation
 * time, where an order waiting for the customer to pay becomes an order waiting
 * for confirmation — see `markOrderAwaitingConfirmation`.
 */

/** `PAY-2026-XXXXXX` — quotable over the phone, unguessable in a URL. */
export function newPaymentReference(): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
  return `PAY-${new Date().getFullYear()}-${suffix}`;
}

export function newIdempotencyKey(): string {
  return randomUUID();
}

export type PaymentForActor = {
  id: string;
  reference: string;
  status: PaymentStatus;
  method: PaymentMethod;
  amountMinor: number;
  provider: string | null;
  providerReference: string | null;
  orderId: string | null;
  orderNumber: string | null;
  projectId: string | null;
  customerId: string;
  customerName: string;
  supplierId: string | null;
  supplierUserId: string | null;
  supplierName: string | null;
};

/**
 * Loads a payment the signed-in user is a party to. Anyone else gets a
 * not-found, which is also the correct answer for a guessed id.
 */
export async function loadPaymentForActor(
  paymentId: string,
  user: SessionUser,
): Promise<PaymentForActor> {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      reference: true,
      status: true,
      method: true,
      amountMinor: true,
      provider: true,
      providerReference: true,
      orderId: true,
      projectId: true,
      customerId: true,
      supplierId: true,
      customer: { select: { name: true } },
      order: { select: { orderNumber: true } },
      supplier: { select: { userId: true, businessName: true } },
    },
  });

  if (!payment) throw new NotFoundError("payment");

  const isParty =
    payment.customerId === user.id || payment.supplier?.userId === user.id;
  if (!isParty && !isAdminRole(user.role)) throw new NotFoundError("payment");

  return {
    id: payment.id,
    reference: payment.reference,
    status: payment.status,
    method: payment.method,
    amountMinor: payment.amountMinor,
    provider: payment.provider,
    providerReference: payment.providerReference,
    orderId: payment.orderId,
    orderNumber: payment.order?.orderNumber ?? null,
    projectId: payment.projectId,
    customerId: payment.customerId,
    customerName: payment.customer.name,
    supplierId: payment.supplierId,
    supplierUserId: payment.supplier?.userId ?? null,
    supplierName: payment.supplier?.businessName ?? null,
  };
}

export type CreatePaymentInput = {
  orderId: string;
  projectId: string | null;
  customerId: string;
  supplierId: string;
  method: PaymentMethod;
  amountMinor: number;
  status: Extract<PaymentStatus, "INITIATED" | "PENDING">;
  provider?: string | null;
  providerReference?: string | null;
  reference?: string | null;
  note?: string | null;
  actor: SessionUser;
};

/**
 * Creates a payment record and its first ledger row.
 *
 * The `reference` a customer types (a bank reference, a mobile-money
 * transaction id) is stored on the ledger row rather than overwriting the
 * BuildLink reference, so both survive: ours identifies the record, theirs
 * proves the transfer.
 */
export async function createPayment(input: CreatePaymentInput): Promise<{
  id: string;
  reference: string;
}> {
  return db.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        reference: newPaymentReference(),
        orderId: input.orderId,
        projectId: input.projectId,
        customerId: input.customerId,
        supplierId: input.supplierId,
        method: input.method,
        direction: "CUSTOMER_TO_SUPPLIER",
        status: input.status,
        amountMinor: input.amountMinor,
        provider: input.provider ?? null,
        providerReference: input.providerReference ?? null,
        idempotencyKey: newIdempotencyKey(),
        transactions: {
          create: {
            toStatus: input.status,
            amountMinor: input.amountMinor,
            provider: input.provider ?? null,
            providerReference: input.providerReference ?? null,
            metadata: paymentMetadata({
              customerReference: input.reference ?? null,
              note: input.note ?? null,
            }),
            actorUserId: input.actor.id,
          },
        },
      },
      select: { id: true, reference: true },
    });

    await recordAudit(
      {
        action: requiresManualConfirmation(input.method)
          ? AUDIT_ACTIONS.paymentRecorded
          : AUDIT_ACTIONS.paymentInitiated,
        resourceType: "payment",
        resourceId: payment.id,
        actorUserId: input.actor.id,
        actorRole: input.actor.role,
        newValue: {
          method: input.method,
          status: input.status,
          amountMinor: input.amountMinor,
          orderId: input.orderId,
        },
      },
      tx,
    );

    return payment;
  });
}

function paymentMetadata(values: Record<string, unknown>): Prisma.InputJsonValue {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined) cleaned[key] = value;
  }
  return cleaned as Prisma.InputJsonValue;
}

export type ApplyPaymentStatusInput = {
  payment: PaymentForActor;
  to: PaymentStatus;
  actor: SessionUser | null;
  providerReference?: string | null;
  metadata?: Record<string, unknown>;
  failureReason?: string | null;
  note?: string | null;
};

/**
 * The single path through which a payment status changes.
 *
 * Appends the immutable ledger row, updates the current state, writes the audit
 * entry and tells the party who did not make the change. Legality is checked
 * here; authorisation is the caller's job.
 */
export async function applyPaymentStatus(input: ApplyPaymentStatusInput): Promise<void> {
  const { payment, to, actor } = input;
  assertPaymentTransition(payment.status, to);

  const now = new Date();
  const confirmedByHuman = to === "SUCCESSFUL" && requiresManualConfirmation(payment.method);

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: to,
        providerReference: input.providerReference ?? payment.providerReference,
        failureReason: input.failureReason ?? null,
        confirmedById: confirmedByHuman ? (actor?.id ?? null) : null,
        confirmedAt: to === "SUCCESSFUL" ? now : null,
      },
    });

    await tx.paymentTransaction.create({
      data: {
        paymentId: payment.id,
        fromStatus: payment.status,
        toStatus: to,
        amountMinor: payment.amountMinor,
        provider: payment.provider,
        providerReference: input.providerReference ?? payment.providerReference,
        metadata: paymentMetadata({
          ...(input.metadata ?? {}),
          note: input.note ?? null,
          failureReason: input.failureReason ?? null,
        }),
        actorUserId: actor?.id ?? null,
      },
    });

    await recordAudit(
      {
        action: AUDIT_ACTIONS.paymentStatusChanged,
        resourceType: "payment",
        resourceId: payment.id,
        actorUserId: actor?.id ?? null,
        actorRole: actor?.role ?? null,
        previousValue: { status: payment.status },
        newValue: { status: to, note: input.note ?? null },
      },
      tx,
    );
  });

  await notifyPaymentOutcome(input);
}

async function notifyPaymentOutcome(input: ApplyPaymentStatusInput): Promise<void> {
  const { payment, to, actor } = input;
  const amount = formatZmw(payment.amountMinor);
  const orderLabel = payment.orderNumber ? ` for order ${payment.orderNumber}` : "";

  if (to === "SUCCESSFUL") {
    await notify({
      userId: payment.customerId,
      type: "PAYMENT_RECEIVED",
      title: `Payment of ${amount} confirmed`,
      body: `${payment.supplierName ?? "The supplier"} has confirmed receiving ${amount}${orderLabel}.`,
      linkUrl: payment.orderId ? `/orders/${payment.orderId}` : "/orders",
    });
    return;
  }

  if (to === "FAILED" || to === "CANCELLED") {
    await notify({
      userId: payment.customerId,
      type: "PAYMENT_FAILED",
      title: `Payment of ${amount} was not completed`,
      body:
        input.failureReason ??
        `The payment${orderLabel} did not go through. You can try again or pay the supplier directly and record it.`,
      linkUrl: payment.orderId ? `/orders/${payment.orderId}` : "/orders",
    });
    return;
  }

  // A payment moving into PENDING is the customer telling the supplier to look
  // for the money, so the supplier is the one who needs to hear about it.
  if (to === "PENDING" && payment.supplierUserId && actor?.id === payment.customerId) {
    await notify({
      userId: payment.supplierUserId,
      type: "PAYMENT_RECEIVED",
      title: `${payment.customerName} recorded a payment of ${amount}`,
      body: `Confirm whether ${amount}${orderLabel} has reached you (${PAYMENT_METHOD_LABELS[payment.method]}).`,
      linkUrl: payment.orderId ? `/supplier/orders/${payment.orderId}` : "/supplier/orders",
    });
  }
}

/**
 * Tells the supplier's side of the order that the customer has done their part.
 *
 * `PENDING_PAYMENT` means "we are waiting for the customer"; `PAYMENT_PENDING`
 * means "the customer has acted and we are waiting for the money to be
 * confirmed". Nothing else about the order changes.
 */
export async function markOrderAwaitingConfirmation(
  orderId: string,
  actor: SessionUser,
): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  if (!order || order.status !== "PENDING_PAYMENT") return;

  await db.order.update({
    where: { id: orderId },
    data: {
      status: "PAYMENT_PENDING",
      events: {
        create: {
          fromStatus: "PENDING_PAYMENT",
          toStatus: "PAYMENT_PENDING",
          note: "Customer recorded a payment.",
          actorUserId: actor.id,
          actorRole: actor.role,
        },
      },
    },
  });
}

/**
 * Records a refund against a settled payment.
 *
 * Money moving back is a real event for the customer's plan, so it also reverses
 * the project's spend: a REFUND budget transaction and a REFUND_RECORDED wallet
 * entry, both traceable to the payment.
 */
export async function recordRefund(input: {
  payment: PaymentForActor;
  actor: SessionUser;
  reason: string;
}): Promise<void> {
  await applyPaymentStatus({
    payment: input.payment,
    to: "REFUNDED",
    actor: input.actor,
    note: input.reason,
    metadata: { refund: true },
  });

  if (!input.payment.projectId) return;

  await db.$transaction(async (tx) => {
    await tx.budgetTransaction.create({
      data: {
        projectId: input.payment.projectId as string,
        type: "REFUND",
        amountMinor: input.payment.amountMinor,
        description: `Refund recorded against payment ${input.payment.reference}`,
        paymentId: input.payment.id,
        createdById: input.actor.id,
      },
    });
    await tx.walletEntry.create({
      data: {
        projectId: input.payment.projectId as string,
        type: "REFUND_RECORDED",
        amountMinor: input.payment.amountMinor,
        description: `Refund from ${input.payment.supplierName ?? "supplier"}`,
        reference: input.payment.reference,
        paymentId: input.payment.id,
        createdById: input.actor.id,
      },
    });

    await recordAudit(
      {
        action: AUDIT_ACTIONS.refundRecorded,
        resourceType: "payment",
        resourceId: input.payment.id,
        actorUserId: input.actor.id,
        actorRole: input.actor.role,
        newValue: { amountMinor: input.payment.amountMinor, reason: input.reason },
      },
      tx,
    );
  });
}
