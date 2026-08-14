import type { FulfilmentMethod, OrderStatus, UserRole } from "@prisma/client";
import { InvalidTransitionError } from "@/lib/errors";
import { isAdminRole } from "@/lib/auth/permissions";

/**
 * Order state machine.
 *
 * Two payment-ish states exist on purpose:
 *  * `PENDING_PAYMENT` — BuildLink is waiting for the customer to act.
 *  * `PAYMENT_PENDING` — the customer has acted and we are waiting for the
 *    provider (or the supplier, for offline transfers) to confirm the money.
 *
 * Every status change goes through `assertOrderTransition`, so no code path can
 * invent a state jump, and an `OrderEvent` is appended for the timeline.
 */

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  DRAFT: ["PENDING_PAYMENT", "CANCELLED"],
  PENDING_PAYMENT: ["PAYMENT_PENDING", "CONFIRMED", "CANCELLED"],
  PAYMENT_PENDING: ["CONFIRMED", "PENDING_PAYMENT", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "READY_FOR_DELIVERY", "CANCELLED", "DISPUTED"],
  PROCESSING: ["READY_FOR_DELIVERY", "OUT_FOR_DELIVERY", "CANCELLED", "DISPUTED"],
  READY_FOR_DELIVERY: ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "DISPUTED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "DISPUTED", "CANCELLED"],
  DELIVERED: ["COMPLETED", "DISPUTED"],
  COMPLETED: ["DISPUTED"],
  CANCELLED: ["REFUNDED"],
  DISPUTED: ["COMPLETED", "CANCELLED", "REFUNDED"],
  REFUNDED: [],
};

/** Statuses that mean the order is finished, one way or another. */
export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = [
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
];

/** Statuses in which the supplier still has work to do. */
export const OPEN_ORDER_STATUSES: readonly OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "PROCESSING",
  "READY_FOR_DELIVERY",
  "OUT_FOR_DELIVERY",
];

/** Statuses that count towards a supplier's revenue and completed-order stats. */
export const REVENUE_ORDER_STATUSES: readonly OrderStatus[] = [
  "DELIVERED",
  "COMPLETED",
];

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  return (ORDER_TRANSITIONS[from] ?? []).includes(to);
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrder(from, to)) {
    throw new InvalidTransitionError("order", from, to);
  }
}

/**
 * Who is allowed to make a given move. Ownership (this supplier owns this
 * order) is checked separately by the caller; this answers only "is this kind
 * of actor ever allowed to do this?".
 */
const SUPPLIER_ALLOWED_TARGETS: readonly OrderStatus[] = [
  "CONFIRMED",
  "PROCESSING",
  "READY_FOR_DELIVERY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
];

const CUSTOMER_ALLOWED_TARGETS: readonly OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAYMENT_PENDING",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
];

const DELIVERY_ALLOWED_TARGETS: readonly OrderStatus[] = ["OUT_FOR_DELIVERY", "DELIVERED"];

export function actorCanTransitionOrder(
  role: UserRole,
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  if (!canTransitionOrder(from, to)) return false;
  if (isAdminRole(role)) return true;

  switch (role) {
    case "SUPPLIER":
      return SUPPLIER_ALLOWED_TARGETS.includes(to);
    case "CUSTOMER":
    case "PROFESSIONAL":
      // A customer may only cancel before the supplier starts preparing goods.
      if (to === "CANCELLED") {
        return ["DRAFT", "PENDING_PAYMENT", "PAYMENT_PENDING", "CONFIRMED"].includes(from);
      }
      return CUSTOMER_ALLOWED_TARGETS.includes(to);
    case "DELIVERY_PROVIDER":
      return DELIVERY_ALLOWED_TARGETS.includes(to);
    default:
      return false;
  }
}

/** The next status a supplier would normally move to, for a one-tap action. */
export function nextSupplierAction(
  status: OrderStatus,
  fulfilment: FulfilmentMethod,
): { to: OrderStatus; label: string } | null {
  switch (status) {
    case "PENDING_PAYMENT":
    case "PAYMENT_PENDING":
      return { to: "CONFIRMED", label: "Confirm order" };
    case "CONFIRMED":
      return { to: "PROCESSING", label: "Start preparing" };
    case "PROCESSING":
      return { to: "READY_FOR_DELIVERY", label: "Mark ready" };
    case "READY_FOR_DELIVERY":
      return fulfilment === "CUSTOMER_PICKUP"
        ? { to: "DELIVERED", label: "Mark collected" }
        : { to: "OUT_FOR_DELIVERY", label: "Dispatch" };
    case "OUT_FOR_DELIVERY":
      return { to: "DELIVERED", label: "Mark delivered" };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export type TimelineState = "done" | "current" | "upcoming" | "failed";

export type TimelineStep = {
  key: string;
  label: string;
  state: TimelineState;
  at: Date | null;
  note: string | null;
};

/**
 * The customer-facing order timeline. Built from the recorded events, so it
 * reflects what actually happened rather than a guess from the current status.
 */
export function buildOrderTimeline(input: {
  status: OrderStatus;
  fulfilmentMethod: FulfilmentMethod;
  events: ReadonlyArray<{ toStatus: OrderStatus; createdAt: Date; note: string | null }>;
}): TimelineStep[] {
  const { status, fulfilmentMethod, events } = input;

  const firstEvent = (target: OrderStatus) =>
    events.find((event) => event.toStatus === target) ?? null;

  const isCancelled = status === "CANCELLED" || status === "REFUNDED";

  const skeleton: Array<{ key: string; label: string; statuses: OrderStatus[] }> = [
    { key: "placed", label: "Order placed", statuses: ["PENDING_PAYMENT", "PAYMENT_PENDING"] },
    { key: "confirmed", label: "Supplier confirmed", statuses: ["CONFIRMED"] },
    { key: "processing", label: "Preparing your order", statuses: ["PROCESSING"] },
    {
      key: "ready",
      label:
        fulfilmentMethod === "CUSTOMER_PICKUP" ? "Ready for collection" : "Ready for delivery",
      statuses: ["READY_FOR_DELIVERY"],
    },
  ];

  if (fulfilmentMethod !== "CUSTOMER_PICKUP") {
    skeleton.push({ key: "dispatched", label: "Out for delivery", statuses: ["OUT_FOR_DELIVERY"] });
  }

  skeleton.push({
    key: "delivered",
    label: fulfilmentMethod === "CUSTOMER_PICKUP" ? "Collected" : "Delivered",
    statuses: ["DELIVERED"],
  });
  skeleton.push({ key: "completed", label: "Completed", statuses: ["COMPLETED"] });

  const reachedIndex = skeleton.reduce((highest, step, index) => {
    const reached = step.statuses.some((candidate) => firstEvent(candidate) !== null);
    return reached ? index : highest;
  }, -1);

  const steps: TimelineStep[] = skeleton.map((step, index) => {
    const event = step.statuses.map(firstEvent).find((candidate) => candidate !== null) ?? null;

    let state: TimelineState;
    if (event) {
      state = index === reachedIndex && !isCancelled ? "current" : "done";
    } else if (isCancelled) {
      state = "upcoming";
    } else {
      state = index === reachedIndex + 1 ? "current" : "upcoming";
    }

    return {
      key: step.key,
      label: step.label,
      state,
      at: event?.createdAt ?? null,
      note: event?.note ?? null,
    };
  });

  if (isCancelled) {
    const cancelEvent = firstEvent("CANCELLED") ?? firstEvent("REFUNDED");
    steps.push({
      key: status === "REFUNDED" ? "refunded" : "cancelled",
      label: status === "REFUNDED" ? "Refund recorded" : "Order cancelled",
      state: "failed",
      at: cancelEvent?.createdAt ?? null,
      note: cancelEvent?.note ?? null,
    });
  }

  if (status === "DISPUTED") {
    const disputeEvent = firstEvent("DISPUTED");
    steps.push({
      key: "disputed",
      label: "Dispute raised",
      state: "failed",
      at: disputeEvent?.createdAt ?? null,
      note: disputeEvent?.note ?? null,
    });
  }

  return steps;
}
