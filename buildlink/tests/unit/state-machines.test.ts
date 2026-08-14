import type { OrderStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { InvalidTransitionError } from "@/lib/errors";
import {
  actorCanTransitionOrder,
  assertOrderTransition,
  buildOrderTimeline,
  canTransitionOrder,
  nextSupplierAction,
  ORDER_TRANSITIONS,
} from "@/lib/domain/order-status";
import {
  assertPaymentTransition,
  canTransitionPayment,
  describePaymentCustody,
  PAYMENT_TRANSITIONS,
  requiresManualConfirmation,
  summarisePayments,
} from "@/lib/domain/payment-status";
import {
  assertContractTransition,
  canRespondToContract,
  canTransitionContract,
  CONTRACT_LEGAL_NOTICE,
  CONTRACT_TRANSITIONS,
  describeAcceptance,
} from "@/lib/domain/contract-status";
import {
  actorCanTransitionDelivery,
  buildDeliveryTimeline,
  canTransitionDelivery,
  DELIVERY_TRANSITIONS,
  orderStatusForDelivery,
  requiresProofOfDelivery,
} from "@/lib/domain/delivery-status";

const at = (minutes: number) => new Date(Date.UTC(2026, 0, 1, 8, minutes, 0));

describe("order state machine", () => {
  it("never lets a status transition to itself", () => {
    for (const status of Object.keys(ORDER_TRANSITIONS) as OrderStatus[]) {
      expect(canTransitionOrder(status, status)).toBe(false);
    }
  });

  it("declares every status in the table so no status is unreachable by omission", () => {
    for (const [from, targets] of Object.entries(ORDER_TRANSITIONS)) {
      for (const to of targets) {
        expect(ORDER_TRANSITIONS[to], `${from} -> ${to} has no outbound entry`).toBeDefined();
      }
    }
  });

  it("walks the happy path from placement to completion", () => {
    const path: OrderStatus[] = [
      "DRAFT",
      "PENDING_PAYMENT",
      "PAYMENT_PENDING",
      "CONFIRMED",
      "PROCESSING",
      "READY_FOR_DELIVERY",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "COMPLETED",
    ];
    for (let index = 0; index < path.length - 1; index += 1) {
      expect(canTransitionOrder(path[index]!, path[index + 1]!)).toBe(true);
    }
  });

  it("rejects state jumps and treats REFUNDED as terminal", () => {
    expect(canTransitionOrder("DRAFT", "DELIVERED")).toBe(false);
    expect(canTransitionOrder("PENDING_PAYMENT", "COMPLETED")).toBe(false);
    expect(ORDER_TRANSITIONS.REFUNDED).toEqual([]);
    expect(() => assertOrderTransition("DRAFT", "COMPLETED")).toThrow(InvalidTransitionError);
    expect(() => assertOrderTransition("DRAFT", "PENDING_PAYMENT")).not.toThrow();
  });

  it("keeps confirmation with the supplier and completion with the customer", () => {
    expect(actorCanTransitionOrder("SUPPLIER", "PENDING_PAYMENT", "CONFIRMED")).toBe(true);
    expect(actorCanTransitionOrder("CUSTOMER", "PENDING_PAYMENT", "CONFIRMED")).toBe(false);
    expect(actorCanTransitionOrder("CUSTOMER", "DELIVERED", "COMPLETED")).toBe(true);
    expect(actorCanTransitionOrder("SUPPLIER", "DELIVERED", "COMPLETED")).toBe(false);
  });

  it("stops a customer cancelling once the supplier is preparing goods", () => {
    expect(actorCanTransitionOrder("CUSTOMER", "PENDING_PAYMENT", "CANCELLED")).toBe(true);
    expect(actorCanTransitionOrder("CUSTOMER", "CONFIRMED", "CANCELLED")).toBe(true);
    expect(actorCanTransitionOrder("CUSTOMER", "PROCESSING", "CANCELLED")).toBe(false);
  });

  it("limits a delivery provider to dispatch and delivery", () => {
    expect(actorCanTransitionOrder("DELIVERY_PROVIDER", "READY_FOR_DELIVERY", "OUT_FOR_DELIVERY")).toBe(
      true,
    );
    expect(actorCanTransitionOrder("DELIVERY_PROVIDER", "PENDING_PAYMENT", "CONFIRMED")).toBe(false);
  });

  it("lets admins make any legal move but no illegal one", () => {
    expect(actorCanTransitionOrder("ADMIN", "DELIVERED", "COMPLETED")).toBe(true);
    expect(actorCanTransitionOrder("SUPER_ADMIN", "PROCESSING", "CANCELLED")).toBe(true);
    expect(actorCanTransitionOrder("ADMIN", "DRAFT", "COMPLETED")).toBe(false);
  });

  it("gives artisans no order powers at all", () => {
    expect(actorCanTransitionOrder("ARTISAN", "PENDING_PAYMENT", "CONFIRMED")).toBe(false);
  });

  it("offers the right one-tap supplier action, including for pickup orders", () => {
    expect(nextSupplierAction("CONFIRMED", "SUPPLIER_DELIVERY")?.to).toBe("PROCESSING");
    expect(nextSupplierAction("READY_FOR_DELIVERY", "SUPPLIER_DELIVERY")?.to).toBe(
      "OUT_FOR_DELIVERY",
    );
    expect(nextSupplierAction("READY_FOR_DELIVERY", "CUSTOMER_PICKUP")?.to).toBe("DELIVERED");
    expect(nextSupplierAction("COMPLETED", "SUPPLIER_DELIVERY")).toBeNull();
  });
});

describe("buildOrderTimeline", () => {
  it("marks reached steps done, the latest current and the rest upcoming", () => {
    const steps = buildOrderTimeline({
      status: "PROCESSING",
      fulfilmentMethod: "SUPPLIER_DELIVERY",
      events: [
        { toStatus: "PENDING_PAYMENT", createdAt: at(0), note: null },
        { toStatus: "CONFIRMED", createdAt: at(10), note: "Stock reserved" },
        { toStatus: "PROCESSING", createdAt: at(20), note: null },
      ],
    });

    const byKey = Object.fromEntries(steps.map((step) => [step.key, step]));
    expect(byKey.placed?.state).toBe("done");
    expect(byKey.confirmed?.state).toBe("done");
    expect(byKey.confirmed?.note).toBe("Stock reserved");
    expect(byKey.processing?.state).toBe("current");
    expect(byKey.ready?.state).toBe("upcoming");
    expect(byKey.delivered?.state).toBe("upcoming");
    // Exactly one step is highlighted, so the customer sees one clear "you are here".
    expect(steps.filter((step) => step.state === "current")).toHaveLength(1);
  });

  it("highlights the first step for an order that has only just been drafted", () => {
    const steps = buildOrderTimeline({
      status: "DRAFT",
      fulfilmentMethod: "SUPPLIER_DELIVERY",
      events: [],
    });
    expect(steps[0]?.state).toBe("current");
    expect(steps.filter((step) => step.state === "current")).toHaveLength(1);
  });

  it("drops the dispatch step and relabels delivery for a pickup order", () => {
    const steps = buildOrderTimeline({
      status: "READY_FOR_DELIVERY",
      fulfilmentMethod: "CUSTOMER_PICKUP",
      events: [{ toStatus: "READY_FOR_DELIVERY", createdAt: at(0), note: null }],
    });

    expect(steps.map((step) => step.key)).not.toContain("dispatched");
    expect(steps.find((step) => step.key === "ready")?.label).toBe("Ready for collection");
    expect(steps.find((step) => step.key === "delivered")?.label).toBe("Collected");
  });

  it("appends a failed step for cancellations and disputes", () => {
    const cancelled = buildOrderTimeline({
      status: "CANCELLED",
      fulfilmentMethod: "SUPPLIER_DELIVERY",
      events: [
        { toStatus: "PENDING_PAYMENT", createdAt: at(0), note: null },
        { toStatus: "CANCELLED", createdAt: at(5), note: "Customer changed plans" },
      ],
    });
    const last = cancelled.at(-1)!;
    expect(last.key).toBe("cancelled");
    expect(last.state).toBe("failed");
    expect(last.note).toBe("Customer changed plans");
    expect(cancelled.some((step) => step.state === "current")).toBe(false);

    const disputed = buildOrderTimeline({
      status: "DISPUTED",
      fulfilmentMethod: "SUPPLIER_DELIVERY",
      events: [{ toStatus: "DISPUTED", createdAt: at(9), note: "Short delivery" }],
    });
    expect(disputed.at(-1)?.key).toBe("disputed");
  });
});

describe("payment state machine", () => {
  it("only reaches SUCCESSFUL from an in-flight state", () => {
    expect(canTransitionPayment("INITIATED", "SUCCESSFUL")).toBe(true);
    expect(canTransitionPayment("PENDING", "SUCCESSFUL")).toBe(true);
    expect(canTransitionPayment("FAILED", "SUCCESSFUL")).toBe(false);
    expect(canTransitionPayment("REFUNDED", "SUCCESSFUL")).toBe(false);
    expect(PAYMENT_TRANSITIONS.REFUNDED).toEqual([]);
    expect(() => assertPaymentTransition("FAILED", "SUCCESSFUL")).toThrow(InvalidTransitionError);
  });

  it("allows a failed attempt to be retried", () => {
    expect(canTransitionPayment("FAILED", "INITIATED")).toBe(true);
    expect(canTransitionPayment("CANCELLED", "INITIATED")).toBe(true);
  });

  it("requires a human to confirm every offline method", () => {
    expect(requiresManualConfirmation("RECORDED_CASH")).toBe(true);
    expect(requiresManualConfirmation("RECORDED_BANK_TRANSFER")).toBe(true);
    expect(requiresManualConfirmation("RECORDED_MOBILE_MONEY")).toBe(true);
    expect(requiresManualConfirmation("SANDBOX")).toBe(false);
  });

  it("never claims BuildLink holds the money", () => {
    for (const method of ["RECORDED_CASH", "SANDBOX", "MOBILE_MONEY", "CARD"] as const) {
      expect(describePaymentCustody(method)).not.toMatch(/buildlink holds/i);
    }
    expect(describePaymentCustody("RECORDED_CASH")).toMatch(/does not hold the funds/i);
    expect(describePaymentCustody("SANDBOX")).toMatch(/no real money/i);
  });

  it("summarises settled, pending and outstanding amounts", () => {
    const summary = summarisePayments(
      [
        { status: "SUCCESSFUL", amountMinor: 60_000 },
        { status: "PENDING", amountMinor: 20_000 },
        { status: "FAILED", amountMinor: 10_000 },
        { status: "REFUNDED", amountMinor: 5_000 },
      ],
      100_000,
    );

    expect(summary.settledMinor).toBe(60_000);
    expect(summary.pendingMinor).toBe(20_000);
    expect(summary.refundedMinor).toBe(5_000);
    expect(summary.outstandingMinor).toBe(40_000);
    expect(summary.isFullySettled).toBe(false);
  });

  it("treats an overpayment as settled without a negative outstanding balance", () => {
    const summary = summarisePayments([{ status: "SUCCESSFUL", amountMinor: 120_000 }], 100_000);
    expect(summary.outstandingMinor).toBe(0);
    expect(summary.isFullySettled).toBe(true);
  });

  it("does not call a zero-total order settled", () => {
    expect(summarisePayments([], 0).isFullySettled).toBe(false);
  });
});

describe("contract state machine", () => {
  it("cannot be accepted before it has been sent", () => {
    expect(canTransitionContract("DRAFT", "ACCEPTED")).toBe(false);
    expect(canTransitionContract("DRAFT", "SENT")).toBe(true);
    expect(canTransitionContract("SENT", "ACCEPTED")).toBe(true);
  });

  it("lets a rejected agreement be redrafted but keeps completion terminal", () => {
    expect(canTransitionContract("REJECTED", "DRAFT")).toBe(true);
    expect(CONTRACT_TRANSITIONS.COMPLETED).toEqual([]);
    expect(CONTRACT_TRANSITIONS.CANCELLED).toEqual([]);
    expect(() => assertContractTransition("COMPLETED", "DRAFT")).toThrow(InvalidTransitionError);
  });

  it("only lets the counterparty respond, and only while the agreement is out", () => {
    expect(canRespondToContract("SENT", "CUSTOMER", "SUPPLIER")).toBe(true);
    expect(canRespondToContract("SENT", "SUPPLIER", "CUSTOMER")).toBe(true);
    // The party who drew the agreement up cannot accept on the other's behalf.
    expect(canRespondToContract("SENT", "SUPPLIER", "SUPPLIER")).toBe(false);
    expect(canRespondToContract("ACCEPTED", "CUSTOMER", "SUPPLIER")).toBe(false);
    expect(canRespondToContract("DRAFT", "CUSTOMER", "SUPPLIER")).toBe(false);
  });

  it("keeps the legal notice honest about what the record is", () => {
    expect(CONTRACT_LEGAL_NOTICE).toMatch(/not been reviewed by a lawyer/i);
    expect(CONTRACT_LEGAL_NOTICE).toMatch(/qualified legal practitioner/i);
  });

  it("binds an acceptance to the contract version that was signed", () => {
    const description = describeAcceptance({
      signatureName: "Chanda Mulenga",
      role: "CUSTOMER",
      acceptedAt: at(0),
      contractVersion: 2,
    });
    expect(description).toContain("Customer");
    expect(description).toContain("Chanda Mulenga");
    expect(description).toContain("version 2");
  });
});

describe("delivery state machine", () => {
  it("moves a third-party job from request to delivery", () => {
    const path = ["REQUESTED", "ASSIGNED", "ACCEPTED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"] as const;
    for (let index = 0; index < path.length - 1; index += 1) {
      expect(canTransitionDelivery(path[index]!, path[index + 1]!)).toBe(true);
    }
    expect(DELIVERY_TRANSITIONS.DELIVERED).toEqual([]);
    expect(DELIVERY_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it("allows a failed delivery to be retried or reassigned", () => {
    expect(canTransitionDelivery("FAILED", "ASSIGNED")).toBe(true);
    expect(canTransitionDelivery("FAILED", "IN_TRANSIT")).toBe(true);
    expect(canTransitionDelivery("DELIVERED", "FAILED")).toBe(false);
  });

  it("limits each actor to the moves they can actually make", () => {
    expect(actorCanTransitionDelivery("DELIVERY_PROVIDER", "ACCEPTED", "PICKED_UP")).toBe(true);
    expect(actorCanTransitionDelivery("DELIVERY_PROVIDER", "REQUESTED", "CANCELLED")).toBe(false);
    expect(actorCanTransitionDelivery("SUPPLIER", "REQUESTED", "CANCELLED")).toBe(true);
    expect(actorCanTransitionDelivery("CUSTOMER", "REQUESTED", "CANCELLED")).toBe(true);
    expect(actorCanTransitionDelivery("CUSTOMER", "ACCEPTED", "CANCELLED")).toBe(false);
    expect(actorCanTransitionDelivery("ARTISAN", "REQUESTED", "ASSIGNED")).toBe(false);
  });

  it("mirrors delivery progress onto the order status", () => {
    expect(orderStatusForDelivery("PICKED_UP")).toBe("OUT_FOR_DELIVERY");
    expect(orderStatusForDelivery("IN_TRANSIT")).toBe("OUT_FOR_DELIVERY");
    expect(orderStatusForDelivery("DELIVERED")).toBe("DELIVERED");
    expect(orderStatusForDelivery("REQUESTED")).toBeNull();
    expect(orderStatusForDelivery("FAILED")).toBeNull();
  });

  it("only demands proof of delivery for third-party jobs", () => {
    expect(requiresProofOfDelivery("THIRD_PARTY_DELIVERY")).toBe(true);
    expect(requiresProofOfDelivery("SUPPLIER_DELIVERY")).toBe(false);
    expect(requiresProofOfDelivery("CUSTOMER_PICKUP")).toBe(false);
  });

  it("builds a short collection timeline and a full delivery timeline", () => {
    const pickup = buildDeliveryTimeline({
      method: "CUSTOMER_PICKUP",
      status: "ACCEPTED",
      events: [
        { toStatus: "REQUESTED", createdAt: at(0), note: null },
        { toStatus: "ACCEPTED", createdAt: at(30), note: null },
      ],
    });
    expect(pickup.map((step) => step.key)).toEqual(["requested", "ready", "collected"]);
    expect(pickup[0]?.state).toBe("done");
    expect(pickup[1]?.state).toBe("current");
    expect(pickup.filter((step) => step.state === "current")).toHaveLength(1);

    const failed = buildDeliveryTimeline({
      method: "THIRD_PARTY_DELIVERY",
      status: "FAILED",
      events: [
        { toStatus: "REQUESTED", createdAt: at(0), note: null },
        { toStatus: "FAILED", createdAt: at(90), note: "Nobody on site" },
      ],
    });
    expect(failed.at(-1)?.state).toBe("failed");
    expect(failed.at(-1)?.note).toBe("Nobody on site");
  });
});
