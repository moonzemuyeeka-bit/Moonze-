import type { PaymentMethod, PaymentStatus } from "@prisma/client";
import { InvalidTransitionError } from "@/lib/errors";

/**
 * Payment state machine.
 *
 * `SUCCESSFUL` means money actually moved — either a provider confirmed it or a
 * human (the supplier, or an admin) confirmed receipt of an offline transfer.
 * Nothing in the codebase may set `SUCCESSFUL` optimistically, which is why the
 * only route into it is a provider callback or an explicit confirmation action.
 */

export const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  INITIATED: ["PENDING", "SUCCESSFUL", "FAILED", "CANCELLED"],
  PENDING: ["SUCCESSFUL", "FAILED", "CANCELLED"],
  SUCCESSFUL: ["REFUNDED"],
  FAILED: ["INITIATED"],
  CANCELLED: ["INITIATED"],
  REFUNDED: [],
};

export const SETTLED_PAYMENT_STATUSES: readonly PaymentStatus[] = ["SUCCESSFUL"];

export const IN_FLIGHT_PAYMENT_STATUSES: readonly PaymentStatus[] = ["INITIATED", "PENDING"];

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to) return false;
  return (PAYMENT_TRANSITIONS[from] ?? []).includes(to);
}

export function assertPaymentTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!canTransitionPayment(from, to)) {
    throw new InvalidTransitionError("payment", from, to);
  }
}

/**
 * Whether a payment of this method requires a human to confirm receipt.
 *
 * Offline methods (cash, bank transfer, a mobile-money transfer made outside
 * BuildLink) start life as `PENDING` and only become `SUCCESSFUL` once the
 * supplier confirms the funds arrived. BuildLink is the record keeper, not the
 * settlement rail.
 */
export function requiresManualConfirmation(method: PaymentMethod): boolean {
  return (
    method === "RECORDED_BANK_TRANSFER" ||
    method === "RECORDED_CASH" ||
    method === "RECORDED_MOBILE_MONEY"
  );
}

/**
 * The honest one-line description of what a payment record means, shown next to
 * every amount so nobody assumes BuildLink is holding or guaranteeing money.
 */
export function describePaymentCustody(method: PaymentMethod): string {
  if (requiresManualConfirmation(method)) {
    return "Paid directly to the supplier. BuildLink records the payment; it does not hold the funds.";
  }
  if (method === "SANDBOX") {
    return "Test payment created by the BuildLink sandbox. No real money moved.";
  }
  return "Processed by the payment provider and paid to the supplier. BuildLink does not hold the funds.";
}

/** Summarises a set of payments against an order or project total. */
export function summarisePayments(
  payments: ReadonlyArray<{ status: PaymentStatus; amountMinor: number }>,
  totalMinor: number,
): {
  settledMinor: number;
  pendingMinor: number;
  refundedMinor: number;
  outstandingMinor: number;
  isFullySettled: boolean;
} {
  let settledMinor = 0;
  let pendingMinor = 0;
  let refundedMinor = 0;

  for (const payment of payments) {
    if (payment.status === "SUCCESSFUL") settledMinor += payment.amountMinor;
    else if (payment.status === "INITIATED" || payment.status === "PENDING") {
      pendingMinor += payment.amountMinor;
    } else if (payment.status === "REFUNDED") refundedMinor += payment.amountMinor;
  }

  const outstandingMinor = Math.max(0, totalMinor - settledMinor);

  return {
    settledMinor,
    pendingMinor,
    refundedMinor,
    outstandingMinor,
    isFullySettled: totalMinor > 0 && outstandingMinor === 0,
  };
}
