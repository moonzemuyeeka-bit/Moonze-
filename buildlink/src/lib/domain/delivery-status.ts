import type { DeliveryMethod, DeliveryStatus, OrderStatus, UserRole } from "@prisma/client";
import { InvalidTransitionError } from "@/lib/errors";
import { isAdminRole } from "@/lib/auth/permissions";
import type { TimelineStep } from "@/lib/domain/order-status";

/** Delivery state machine, mirrored into the order status where relevant. */

export const DELIVERY_TRANSITIONS: Record<DeliveryStatus, readonly DeliveryStatus[]> = {
  REQUESTED: ["ASSIGNED", "ACCEPTED", "CANCELLED"],
  ASSIGNED: ["ACCEPTED", "REQUESTED", "CANCELLED"],
  ACCEPTED: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT", "DELIVERED", "FAILED"],
  IN_TRANSIT: ["DELIVERED", "FAILED"],
  DELIVERED: [],
  FAILED: ["ASSIGNED", "IN_TRANSIT", "CANCELLED"],
  CANCELLED: [],
};

export function canTransitionDelivery(from: DeliveryStatus, to: DeliveryStatus): boolean {
  if (from === to) return false;
  return (DELIVERY_TRANSITIONS[from] ?? []).includes(to);
}

export function assertDeliveryTransition(from: DeliveryStatus, to: DeliveryStatus): void {
  if (!canTransitionDelivery(from, to)) {
    throw new InvalidTransitionError("delivery", from, to);
  }
}

const PROVIDER_TARGETS: readonly DeliveryStatus[] = [
  "ACCEPTED",
  "PICKED_UP",
  "IN_TRANSIT",
  "DELIVERED",
  "FAILED",
];

const SUPPLIER_TARGETS: readonly DeliveryStatus[] = [
  "ASSIGNED",
  "ACCEPTED",
  "PICKED_UP",
  "IN_TRANSIT",
  "DELIVERED",
  "FAILED",
  "CANCELLED",
];

export function actorCanTransitionDelivery(
  role: UserRole,
  from: DeliveryStatus,
  to: DeliveryStatus,
): boolean {
  if (!canTransitionDelivery(from, to)) return false;
  if (isAdminRole(role)) return true;

  switch (role) {
    case "DELIVERY_PROVIDER":
      return PROVIDER_TARGETS.includes(to);
    case "SUPPLIER":
      return SUPPLIER_TARGETS.includes(to);
    case "CUSTOMER":
      return to === "CANCELLED" && (from === "REQUESTED" || from === "ASSIGNED");
    default:
      return false;
  }
}

/**
 * The order status that should follow a delivery status change, or null when the
 * order should stay where it is. Keeps the two machines consistent without
 * duplicating the rules at each call site.
 */
export function orderStatusForDelivery(status: DeliveryStatus): OrderStatus | null {
  switch (status) {
    case "PICKED_UP":
    case "IN_TRANSIT":
      return "OUT_FOR_DELIVERY";
    case "DELIVERED":
      return "DELIVERED";
    default:
      return null;
  }
}

/** Proof of delivery is required before a third-party job can be closed out. */
export function requiresProofOfDelivery(method: DeliveryMethod): boolean {
  return method === "THIRD_PARTY_DELIVERY";
}

export function buildDeliveryTimeline(input: {
  method: DeliveryMethod;
  status: DeliveryStatus;
  events: ReadonlyArray<{ toStatus: DeliveryStatus; createdAt: Date; note: string | null }>;
}): TimelineStep[] {
  const { method, status, events } = input;
  const firstEvent = (target: DeliveryStatus) =>
    events.find((event) => event.toStatus === target) ?? null;

  const skeleton: Array<{ key: string; label: string; status: DeliveryStatus }> =
    method === "CUSTOMER_PICKUP"
      ? [
          { key: "requested", label: "Collection arranged", status: "REQUESTED" },
          { key: "ready", label: "Ready at supplier", status: "ACCEPTED" },
          { key: "collected", label: "Collected", status: "DELIVERED" },
        ]
      : [
          { key: "requested", label: "Delivery requested", status: "REQUESTED" },
          { key: "assigned", label: "Assigned to provider", status: "ASSIGNED" },
          { key: "accepted", label: "Accepted by provider", status: "ACCEPTED" },
          { key: "picked_up", label: "Picked up", status: "PICKED_UP" },
          { key: "in_transit", label: "In transit", status: "IN_TRANSIT" },
          { key: "delivered", label: "Delivered", status: "DELIVERED" },
        ];

  const reachedIndex = skeleton.reduce(
    (highest, step, index) => (firstEvent(step.status) ? index : highest),
    -1,
  );

  const failed = status === "FAILED" || status === "CANCELLED";

  const steps: TimelineStep[] = skeleton.map((step, index) => {
    const event = firstEvent(step.status);
    let state: TimelineStep["state"];
    if (event) state = index === reachedIndex && !failed ? "current" : "done";
    else if (failed) state = "upcoming";
    else state = index === reachedIndex + 1 ? "current" : "upcoming";

    return {
      key: step.key,
      label: step.label,
      state,
      at: event?.createdAt ?? null,
      note: event?.note ?? null,
    };
  });

  if (failed) {
    const event = firstEvent(status);
    steps.push({
      key: status.toLowerCase(),
      label: status === "FAILED" ? "Delivery failed" : "Delivery cancelled",
      state: "failed",
      at: event?.createdAt ?? null,
      note: event?.note ?? null,
    });
  }

  return steps;
}
