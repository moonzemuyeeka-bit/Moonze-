import { describe, expect, it } from "vitest";
import type { PaymentStatus } from "@/generated/prisma";
import { canTransition, TERMINAL_PAYMENT_STATUSES } from "@/lib/payments/types";

describe("payment state machine", () => {
  it("moves forward through the states a gateway reports", () => {
    expect(canTransition("PENDING", "PROCESSING")).toBe(true);
    expect(canTransition("PROCESSING", "SUCCESSFUL")).toBe(true);
    expect(canTransition("PROCESSING", "FAILED")).toBe(true);
    expect(canTransition("PROCESSING", "CANCELLED")).toBe(true);
    expect(canTransition("PROCESSING", "EXPIRED")).toBe(true);
    expect(canTransition("SUCCESSFUL", "REFUNDED")).toBe(true);
  });

  it("never walks a payment backwards", () => {
    expect(canTransition("SUCCESSFUL", "PROCESSING")).toBe(false);
    expect(canTransition("PROCESSING", "PENDING")).toBe(false);
    expect(canTransition("REFUNDED", "SUCCESSFUL")).toBe(false);
  });

  it("never resurrects a failed, cancelled or expired payment", () => {
    const dead: PaymentStatus[] = ["FAILED", "CANCELLED", "EXPIRED"];
    for (const from of dead) {
      expect(canTransition(from, "SUCCESSFUL")).toBe(false);
      expect(canTransition(from, "PROCESSING")).toBe(false);
    }
  });

  it("treats a repeated webhook as a no-op rather than a transition", () => {
    expect(canTransition("SUCCESSFUL", "SUCCESSFUL")).toBe(false);
    expect(canTransition("PROCESSING", "PROCESSING")).toBe(false);
  });

  it("only allows a refund out of a terminal state", () => {
    for (const status of TERMINAL_PAYMENT_STATUSES) {
      if (status === "SUCCESSFUL") continue;
      expect(canTransition(status, "REFUNDED")).toBe(false);
    }
  });
});
