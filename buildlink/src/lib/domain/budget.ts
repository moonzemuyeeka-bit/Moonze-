import type {
  BudgetCategoryKey,
  BudgetTransactionType,
  PropertyType,
  WalletEntryType,
} from "@prisma/client";
import { BUDGET_CATEGORY_KEYS } from "@/lib/labels";
import { percentageOf } from "@/lib/money";

/**
 * Project budget arithmetic.
 *
 * The budget answers three questions a person building a house asks constantly:
 * what did I plan, what have I spent, and what is left. All amounts are ngwee.
 */

export type BudgetCategoryInput = {
  id: string;
  key: BudgetCategoryKey;
  plannedMinor: number;
};

export type BudgetTransactionInput = {
  categoryId: string | null;
  type: BudgetTransactionType;
  amountMinor: number;
};

export type BudgetCategoryRollup = {
  id: string;
  key: BudgetCategoryKey;
  plannedMinor: number;
  spentMinor: number;
  remainingMinor: number;
  /** Share of this category's plan already spent (0-100, clamped). */
  consumedPercent: number;
  isOverBudget: boolean;
  /** True once spend passes the warning threshold but is still within plan. */
  isNearLimit: boolean;
};

export type BudgetRollup = {
  categories: BudgetCategoryRollup[];
  plannedMinor: number;
  /** Sum of the category plans. */
  allocatedMinor: number;
  /** Headline budget not yet split across categories; negative if over-allocated. */
  unallocatedMinor: number;
  spentMinor: number;
  /** Spend booked against no category. */
  uncategorisedSpentMinor: number;
  depositedMinor: number;
  refundedMinor: number;
  remainingMinor: number;
  consumedPercent: number;
  isOverBudget: boolean;
};

/** Spend above this share of a category plan raises a warning. */
export const BUDGET_WARNING_THRESHOLD_PERCENT = 85;

/** Transaction types that consume budget (as opposed to funding it). */
const SPENDING_TYPES: readonly BudgetTransactionType[] = [
  "EXPENSE",
  "MATERIAL_PURCHASE",
  "ADJUSTMENT",
];

export function summariseBudget(input: {
  estimatedBudgetMinor: number;
  categories: readonly BudgetCategoryInput[];
  transactions: readonly BudgetTransactionInput[];
}): BudgetRollup {
  const spentByCategory = new Map<string, number>();
  let uncategorisedSpentMinor = 0;
  let depositedMinor = 0;
  let refundedMinor = 0;

  for (const transaction of input.transactions) {
    if (transaction.type === "DEPOSIT") {
      depositedMinor += transaction.amountMinor;
      continue;
    }
    if (transaction.type === "REFUND") {
      refundedMinor += transaction.amountMinor;
      continue;
    }
    if (!SPENDING_TYPES.includes(transaction.type)) continue;

    if (transaction.categoryId) {
      spentByCategory.set(
        transaction.categoryId,
        (spentByCategory.get(transaction.categoryId) ?? 0) + transaction.amountMinor,
      );
    } else {
      uncategorisedSpentMinor += transaction.amountMinor;
    }
  }

  const categories: BudgetCategoryRollup[] = input.categories.map((category) => {
    const spentMinor = spentByCategory.get(category.id) ?? 0;
    const consumedPercent = percentageOf(spentMinor, category.plannedMinor);
    return {
      id: category.id,
      key: category.key,
      plannedMinor: category.plannedMinor,
      spentMinor,
      remainingMinor: category.plannedMinor - spentMinor,
      consumedPercent,
      isOverBudget: category.plannedMinor > 0 && spentMinor > category.plannedMinor,
      isNearLimit:
        category.plannedMinor > 0 &&
        spentMinor <= category.plannedMinor &&
        consumedPercent >= BUDGET_WARNING_THRESHOLD_PERCENT,
    };
  });

  const plannedFromCategories = categories.reduce(
    (total, category) => total + category.plannedMinor,
    0,
  );
  // The project's headline estimate governs; category plans are a breakdown of
  // it and may not add up while the customer is still filling them in.
  const plannedMinor = Math.max(input.estimatedBudgetMinor, plannedFromCategories);
  const spentMinor =
    categories.reduce((total, category) => total + category.spentMinor, 0) +
    uncategorisedSpentMinor -
    refundedMinor;

  return {
    categories,
    plannedMinor,
    allocatedMinor: plannedFromCategories,
    unallocatedMinor: input.estimatedBudgetMinor - plannedFromCategories,
    spentMinor,
    uncategorisedSpentMinor,
    depositedMinor,
    refundedMinor,
    remainingMinor: plannedMinor - spentMinor,
    consumedPercent: percentageOf(spentMinor, plannedMinor),
    isOverBudget: plannedMinor > 0 && spentMinor > plannedMinor,
  };
}

// ---------------------------------------------------------------------------
// Suggested allocations
// ---------------------------------------------------------------------------

/**
 * Indicative percentage splits used to pre-fill a new project's budget.
 *
 * These are planning heuristics for a typical Zambian build, not costed
 * estimates: the UI presents them as a starting point and every figure stays
 * editable. Percentages are basis points of the total budget and sum to 10,000.
 */
export const BUDGET_TEMPLATES: Record<
  "HOUSE" | "RENOVATION" | "COMMERCIAL" | "OTHER",
  Partial<Record<BudgetCategoryKey, number>>
> = {
  HOUSE: {
    LAND_AND_SITE_PREPARATION: 500,
    FOUNDATION: 1000,
    WALLING: 1500,
    ROOFING: 1300,
    PLUMBING: 600,
    ELECTRICAL: 600,
    DOORS_AND_WINDOWS: 700,
    FLOORING: 600,
    CEILING: 400,
    PAINTING: 400,
    KITCHEN: 500,
    BATHROOM: 400,
    LABOUR: 1000,
    TRANSPORT: 200,
    PROFESSIONAL_FEES: 200,
    MISCELLANEOUS: 100,
  },
  RENOVATION: {
    LAND_AND_SITE_PREPARATION: 200,
    WALLING: 700,
    ROOFING: 900,
    PLUMBING: 900,
    ELECTRICAL: 900,
    DOORS_AND_WINDOWS: 900,
    FLOORING: 1000,
    CEILING: 600,
    PAINTING: 900,
    KITCHEN: 1000,
    BATHROOM: 900,
    LABOUR: 800,
    TRANSPORT: 200,
    MISCELLANEOUS: 100,
  },
  COMMERCIAL: {
    LAND_AND_SITE_PREPARATION: 700,
    FOUNDATION: 1200,
    WALLING: 1500,
    ROOFING: 1200,
    PLUMBING: 700,
    ELECTRICAL: 900,
    DOORS_AND_WINDOWS: 700,
    FLOORING: 700,
    CEILING: 400,
    PAINTING: 300,
    LABOUR: 1000,
    TRANSPORT: 200,
    PROFESSIONAL_FEES: 500,
    MISCELLANEOUS: 100,
  },
  OTHER: {
    LAND_AND_SITE_PREPARATION: 800,
    FOUNDATION: 1200,
    WALLING: 1600,
    ROOFING: 1400,
    PLUMBING: 700,
    ELECTRICAL: 700,
    DOORS_AND_WINDOWS: 700,
    FLOORING: 700,
    CEILING: 400,
    PAINTING: 400,
    LABOUR: 1000,
    TRANSPORT: 200,
    PROFESSIONAL_FEES: 200,
    MISCELLANEOUS: 200,
  },
};

function templateFor(propertyType: PropertyType) {
  switch (propertyType) {
    case "HOUSE":
    case "APARTMENT":
      return BUDGET_TEMPLATES.HOUSE;
    case "RENOVATION":
      return BUDGET_TEMPLATES.RENOVATION;
    case "COMMERCIAL":
      return BUDGET_TEMPLATES.COMMERCIAL;
    default:
      return BUDGET_TEMPLATES.OTHER;
  }
}

/**
 * Suggested planned amount per category for a new project. Every one of the 16
 * categories is created (so the customer can budget anything later), with zero
 * where the template has no opinion. Rounding difference lands on
 * MISCELLANEOUS so the allocations always add up to the total exactly.
 */
export function suggestBudgetAllocation(
  totalBudgetMinor: number,
  propertyType: PropertyType,
): Array<{ key: BudgetCategoryKey; plannedMinor: number; sortOrder: number }> {
  const template = templateFor(propertyType);
  const allocations = BUDGET_CATEGORY_KEYS.map((key, index) => {
    const bps = template[key] ?? 0;
    return {
      key,
      plannedMinor: Math.round((totalBudgetMinor * bps) / 10_000),
      sortOrder: index,
    };
  });

  if (totalBudgetMinor > 0) {
    const allocated = allocations.reduce((total, item) => total + item.plannedMinor, 0);
    const drift = totalBudgetMinor - allocated;
    if (drift !== 0) {
      const miscellaneous = allocations.find((item) => item.key === "MISCELLANEOUS");
      if (miscellaneous) {
        miscellaneous.plannedMinor = Math.max(0, miscellaneous.plannedMinor + drift);
      }
    }
  }

  return allocations;
}

// ---------------------------------------------------------------------------
// Project wallet ledger
// ---------------------------------------------------------------------------

/**
 * Positive entry types add to the recorded balance; ALLOCATION removes from it.
 *
 * To be explicit, because it matters: this ledger is a record of what the
 * customer says they have set aside for the project and what they have
 * committed to suppliers. BuildLink never holds these funds.
 */
const POSITIVE_WALLET_TYPES: readonly WalletEntryType[] = [
  "DEPOSIT_RECORDED",
  "ALLOCATION_RELEASED",
  "REFUND_RECORDED",
];

export function walletEntrySign(type: WalletEntryType): 1 | -1 {
  if (POSITIVE_WALLET_TYPES.includes(type)) return 1;
  if (type === "ADJUSTMENT") return 1;
  return -1;
}

export type WalletEntryInput = {
  type: WalletEntryType;
  amountMinor: number;
};

export type WalletSummary = {
  balanceMinor: number;
  depositedMinor: number;
  allocatedMinor: number;
  refundedMinor: number;
  entryCount: number;
};

export function summariseWallet(entries: readonly WalletEntryInput[]): WalletSummary {
  let balanceMinor = 0;
  let depositedMinor = 0;
  let allocatedMinor = 0;
  let refundedMinor = 0;

  for (const entry of entries) {
    balanceMinor += walletEntrySign(entry.type) * entry.amountMinor;
    if (entry.type === "DEPOSIT_RECORDED") depositedMinor += entry.amountMinor;
    if (entry.type === "ALLOCATION") allocatedMinor += entry.amountMinor;
    if (entry.type === "ALLOCATION_RELEASED") allocatedMinor -= entry.amountMinor;
    if (entry.type === "REFUND_RECORDED") refundedMinor += entry.amountMinor;
  }

  return {
    balanceMinor,
    depositedMinor,
    allocatedMinor: Math.max(0, allocatedMinor),
    refundedMinor,
    entryCount: entries.length,
  };
}

/** Copy used everywhere the wallet balance appears. Non-negotiable. */
export const WALLET_CUSTODY_NOTICE =
  "BuildLink records the money you set aside and what you commit to suppliers. " +
  "BuildLink does not hold, transfer or guarantee your funds — payments go directly to the supplier.";
