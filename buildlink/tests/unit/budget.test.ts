import { describe, expect, it } from "vitest";
import {
  BUDGET_WARNING_THRESHOLD_PERCENT,
  suggestBudgetAllocation,
  summariseBudget,
  summariseWallet,
  walletEntrySign,
} from "@/lib/domain/budget";
import { BUDGET_CATEGORY_KEYS } from "@/lib/labels";
import { toMinor } from "@/lib/money";

describe("summariseBudget", () => {
  it("rolls spend up per category and across the project", () => {
    const rollup = summariseBudget({
      estimatedBudgetMinor: toMinor(100_000),
      categories: [
        { id: "cat-foundation", key: "FOUNDATION", plannedMinor: toMinor(20_000) },
        { id: "cat-roofing", key: "ROOFING", plannedMinor: toMinor(30_000) },
      ],
      transactions: [
        { categoryId: "cat-foundation", type: "MATERIAL_PURCHASE", amountMinor: toMinor(5_000) },
        { categoryId: "cat-foundation", type: "EXPENSE", amountMinor: toMinor(2_000) },
        { categoryId: null, type: "EXPENSE", amountMinor: toMinor(1_000) },
      ],
    });

    expect(rollup.plannedMinor).toBe(toMinor(100_000));
    expect(rollup.allocatedMinor).toBe(toMinor(50_000));
    expect(rollup.unallocatedMinor).toBe(toMinor(50_000));
    expect(rollup.spentMinor).toBe(toMinor(8_000));
    expect(rollup.uncategorisedSpentMinor).toBe(toMinor(1_000));
    expect(rollup.remainingMinor).toBe(toMinor(92_000));
    expect(rollup.consumedPercent).toBe(8);
    expect(rollup.isOverBudget).toBe(false);

    const foundation = rollup.categories.find((c) => c.key === "FOUNDATION")!;
    expect(foundation.spentMinor).toBe(toMinor(7_000));
    expect(foundation.remainingMinor).toBe(toMinor(13_000));
    expect(foundation.consumedPercent).toBe(35);
  });

  it("counts deposits and refunds separately from spend", () => {
    const rollup = summariseBudget({
      estimatedBudgetMinor: toMinor(10_000),
      categories: [],
      transactions: [
        { categoryId: null, type: "DEPOSIT", amountMinor: toMinor(4_000) },
        { categoryId: null, type: "EXPENSE", amountMinor: toMinor(3_000) },
        { categoryId: null, type: "REFUND", amountMinor: toMinor(500) },
      ],
    });

    expect(rollup.depositedMinor).toBe(toMinor(4_000));
    expect(rollup.refundedMinor).toBe(toMinor(500));
    // A refund reduces net spend rather than topping the budget up.
    expect(rollup.spentMinor).toBe(toMinor(2_500));
  });

  it("flags a category near its limit and one over it", () => {
    const rollup = summariseBudget({
      estimatedBudgetMinor: toMinor(10_000),
      categories: [
        { id: "near", key: "PAINTING", plannedMinor: toMinor(1_000) },
        { id: "over", key: "ROOFING", plannedMinor: toMinor(1_000) },
      ],
      transactions: [
        { categoryId: "near", type: "EXPENSE", amountMinor: toMinor(900) },
        { categoryId: "over", type: "EXPENSE", amountMinor: toMinor(1_200) },
      ],
    });

    const near = rollup.categories.find((c) => c.id === "near")!;
    const over = rollup.categories.find((c) => c.id === "over")!;

    expect(near.consumedPercent).toBeGreaterThanOrEqual(BUDGET_WARNING_THRESHOLD_PERCENT);
    expect(near.isNearLimit).toBe(true);
    expect(near.isOverBudget).toBe(false);
    expect(over.isOverBudget).toBe(true);
    expect(over.isNearLimit).toBe(false);
    expect(over.remainingMinor).toBe(toMinor(-200));
  });

  it("reports over-allocation as negative unallocated funds", () => {
    const rollup = summariseBudget({
      estimatedBudgetMinor: toMinor(10_000),
      categories: [{ id: "a", key: "WALLING", plannedMinor: toMinor(12_000) }],
      transactions: [],
    });

    expect(rollup.unallocatedMinor).toBe(toMinor(-2_000));
    // The larger of the headline estimate and the allocations governs.
    expect(rollup.plannedMinor).toBe(toMinor(12_000));
  });

  it("marks the project over budget once net spend passes the plan", () => {
    const rollup = summariseBudget({
      estimatedBudgetMinor: toMinor(1_000),
      categories: [],
      transactions: [{ categoryId: null, type: "EXPENSE", amountMinor: toMinor(1_500) }],
    });

    expect(rollup.isOverBudget).toBe(true);
    expect(rollup.consumedPercent).toBe(100);
    expect(rollup.remainingMinor).toBe(toMinor(-500));
  });
});

describe("suggestBudgetAllocation", () => {
  it("creates all sixteen categories and allocates the total exactly", () => {
    const total = toMinor(750_000);
    const allocation = suggestBudgetAllocation(total, "HOUSE");

    expect(allocation).toHaveLength(BUDGET_CATEGORY_KEYS.length);
    expect(allocation.map((item) => item.key)).toEqual([...BUDGET_CATEGORY_KEYS]);
    expect(allocation.reduce((sum, item) => sum + item.plannedMinor, 0)).toBe(total);
    expect(allocation.every((item) => item.plannedMinor >= 0)).toBe(true);
  });

  it("weights renovations towards finishes rather than the foundation", () => {
    const total = toMinor(100_000);
    const renovation = suggestBudgetAllocation(total, "RENOVATION");
    const foundation = renovation.find((item) => item.key === "FOUNDATION")!;
    const flooring = renovation.find((item) => item.key === "FLOORING")!;

    expect(foundation.plannedMinor).toBe(0);
    expect(flooring.plannedMinor).toBeGreaterThan(0);
  });

  it("returns zeroed categories for a project with no budget yet", () => {
    const allocation = suggestBudgetAllocation(0, "HOUSE");
    expect(allocation.every((item) => item.plannedMinor === 0)).toBe(true);
  });
});

describe("wallet ledger", () => {
  it("signs entry types so allocations reduce the recorded balance", () => {
    expect(walletEntrySign("DEPOSIT_RECORDED")).toBe(1);
    expect(walletEntrySign("REFUND_RECORDED")).toBe(1);
    expect(walletEntrySign("ALLOCATION_RELEASED")).toBe(1);
    expect(walletEntrySign("ALLOCATION")).toBe(-1);
  });

  it("summarises deposits, allocations and refunds", () => {
    const summary = summariseWallet([
      { type: "DEPOSIT_RECORDED", amountMinor: toMinor(50_000) },
      { type: "ALLOCATION", amountMinor: toMinor(20_000) },
      { type: "ALLOCATION_RELEASED", amountMinor: toMinor(5_000) },
      { type: "REFUND_RECORDED", amountMinor: toMinor(1_000) },
    ]);

    expect(summary.balanceMinor).toBe(toMinor(36_000));
    expect(summary.depositedMinor).toBe(toMinor(50_000));
    expect(summary.allocatedMinor).toBe(toMinor(15_000));
    expect(summary.refundedMinor).toBe(toMinor(1_000));
    expect(summary.entryCount).toBe(4);
  });

  it("never reports a negative outstanding allocation", () => {
    const summary = summariseWallet([
      { type: "ALLOCATION_RELEASED", amountMinor: toMinor(5_000) },
    ]);
    expect(summary.allocatedMinor).toBe(0);
  });
});
