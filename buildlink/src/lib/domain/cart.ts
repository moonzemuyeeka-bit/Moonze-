import type { FulfilmentMethod, ProductUnit, VerificationStatus } from "@prisma/client";

/**
 * Cart arithmetic and supplier splitting.
 *
 * A construction shop almost always spans several suppliers: cement from one
 * yard, blocks from a manufacturer, sand from a haulier. BuildLink therefore
 * treats the cart as a set of per-supplier baskets that each become their own
 * order at checkout — each with its own minimum order, delivery arrangement and
 * agreement — while the customer still sees one running total.
 *
 * Pure functions only: no database, no formatting. Amounts are ngwee.
 */

export type CartSupplierInput = {
  id: string;
  businessName: string;
  slug: string;
  verificationStatus: VerificationStatus;
  isDemo: boolean;
  deliveryAvailable: boolean;
  minimumOrderMinor: number;
  deliveryBaseFeeMinor: number;
  deliveryFreeAboveMinor: number | null;
  provinceName: string;
  districtName: string | null;
};

export type CartLineInput = {
  itemId: string;
  productId: string;
  productName: string;
  brand: string | null;
  unit: ProductUnit;
  unitPriceMinor: number;
  quantity: number;
  minimumOrderQuantity: number;
  stockQuantity: number;
  isAvailable: boolean;
  imageKey: string | null;
  supplier: CartSupplierInput;
};

export type CartLineIssue =
  | { kind: "below_minimum_quantity"; requiredQuantity: number }
  | { kind: "insufficient_stock"; availableQuantity: number }
  | { kind: "unavailable" };

export type CartLine = CartLineInput & {
  lineTotalMinor: number;
  issues: CartLineIssue[];
};

export type CartSupplierGroupIssue =
  | { kind: "below_minimum_order"; shortfallMinor: number; minimumOrderMinor: number }
  | { kind: "delivery_unavailable" };

export type CartSupplierGroup = {
  supplier: CartSupplierInput;
  lines: CartLine[];
  itemCount: number;
  subtotalMinor: number;
  deliveryFeeMinor: number;
  totalMinor: number;
  fulfilmentMethod: FulfilmentMethod;
  issues: CartSupplierGroupIssue[];
};

export type CartSummary = {
  groups: CartSupplierGroup[];
  itemCount: number;
  lineCount: number;
  supplierCount: number;
  subtotalMinor: number;
  deliveryFeeMinor: number;
  totalMinor: number;
  /** True when nothing blocks checkout. */
  isCheckoutable: boolean;
  blockingIssueCount: number;
};

export type FulfilmentSelection = Record<string, FulfilmentMethod>;

/**
 * Delivery fee for one supplier basket.
 *
 * Supplier delivery uses the supplier's flat fee, waived once the basket passes
 * the supplier's free-delivery threshold. Third-party delivery is quoted per
 * provider at checkout, so it is zero here and added once a provider is chosen.
 * Pickup is always free.
 */
export function deliveryFeeFor(
  supplier: CartSupplierInput,
  subtotalMinor: number,
  method: FulfilmentMethod,
): number {
  if (method === "CUSTOMER_PICKUP") return 0;
  if (method === "THIRD_PARTY_DELIVERY") return 0;
  if (!supplier.deliveryAvailable) return 0;
  if (
    supplier.deliveryFreeAboveMinor !== null &&
    subtotalMinor >= supplier.deliveryFreeAboveMinor
  ) {
    return 0;
  }
  return supplier.deliveryBaseFeeMinor;
}

function lineIssues(line: CartLineInput): CartLineIssue[] {
  const issues: CartLineIssue[] = [];
  if (!line.isAvailable) issues.push({ kind: "unavailable" });
  if (line.quantity < line.minimumOrderQuantity) {
    issues.push({
      kind: "below_minimum_quantity",
      requiredQuantity: line.minimumOrderQuantity,
    });
  }
  if (line.quantity > line.stockQuantity) {
    issues.push({ kind: "insufficient_stock", availableQuantity: line.stockQuantity });
  }
  return issues;
}

/**
 * Groups cart lines by supplier and computes every total the checkout needs.
 *
 * `fulfilment` lets the caller pass the customer's per-supplier choice; any
 * supplier without an explicit choice defaults to delivery when the supplier
 * offers it, and pickup when it does not.
 */
export function summariseCart(
  lines: readonly CartLineInput[],
  fulfilment: FulfilmentSelection = {},
): CartSummary {
  const bySupplier = new Map<string, CartLine[]>();

  for (const line of lines) {
    const enriched: CartLine = {
      ...line,
      lineTotalMinor: line.unitPriceMinor * line.quantity,
      issues: lineIssues(line),
    };
    const existing = bySupplier.get(line.supplier.id);
    if (existing) existing.push(enriched);
    else bySupplier.set(line.supplier.id, [enriched]);
  }

  const groups: CartSupplierGroup[] = [];

  for (const supplierLines of bySupplier.values()) {
    const first = supplierLines[0];
    if (!first) continue;
    const supplier = first.supplier;

    const subtotalMinor = supplierLines.reduce((total, line) => total + line.lineTotalMinor, 0);
    const itemCount = supplierLines.reduce((total, line) => total + line.quantity, 0);

    const requested = fulfilment[supplier.id];
    const method: FulfilmentMethod =
      requested ?? (supplier.deliveryAvailable ? "SUPPLIER_DELIVERY" : "CUSTOMER_PICKUP");

    const issues: CartSupplierGroupIssue[] = [];
    if (subtotalMinor < supplier.minimumOrderMinor) {
      issues.push({
        kind: "below_minimum_order",
        shortfallMinor: supplier.minimumOrderMinor - subtotalMinor,
        minimumOrderMinor: supplier.minimumOrderMinor,
      });
    }
    if (method === "SUPPLIER_DELIVERY" && !supplier.deliveryAvailable) {
      issues.push({ kind: "delivery_unavailable" });
    }

    const deliveryFeeMinor = deliveryFeeFor(supplier, subtotalMinor, method);

    groups.push({
      supplier,
      lines: supplierLines,
      itemCount,
      subtotalMinor,
      deliveryFeeMinor,
      totalMinor: subtotalMinor + deliveryFeeMinor,
      fulfilmentMethod: method,
      issues,
    });
  }

  groups.sort((a, b) => a.supplier.businessName.localeCompare(b.supplier.businessName));

  const subtotalMinor = groups.reduce((total, group) => total + group.subtotalMinor, 0);
  const deliveryFeeMinor = groups.reduce((total, group) => total + group.deliveryFeeMinor, 0);
  const blockingIssueCount =
    groups.reduce((total, group) => total + group.issues.length, 0) +
    groups.reduce(
      (total, group) => total + group.lines.reduce((sum, line) => sum + line.issues.length, 0),
      0,
    );

  return {
    groups,
    itemCount: groups.reduce((total, group) => total + group.itemCount, 0),
    lineCount: lines.length,
    supplierCount: groups.length,
    subtotalMinor,
    deliveryFeeMinor,
    totalMinor: subtotalMinor + deliveryFeeMinor,
    isCheckoutable: lines.length > 0 && blockingIssueCount === 0,
    blockingIssueCount,
  };
}

export function describeCartLineIssue(issue: CartLineIssue): string {
  switch (issue.kind) {
    case "below_minimum_quantity":
      return `This supplier's minimum order is ${issue.requiredQuantity} units.`;
    case "insufficient_stock":
      return issue.availableQuantity <= 0
        ? "Out of stock — remove it or ask the supplier when it returns."
        : `Only ${issue.availableQuantity} left in stock.`;
    case "unavailable":
      return "No longer available from this supplier.";
  }
}

export function describeCartGroupIssue(issue: CartSupplierGroupIssue): string {
  switch (issue.kind) {
    case "below_minimum_order":
      return "Add more items to reach this supplier's minimum order.";
    case "delivery_unavailable":
      return "This supplier does not deliver — choose collection or a third-party delivery.";
  }
}

/**
 * Splits the cart into the order payloads created at checkout: one order per
 * supplier, each carrying its own totals and commission snapshot.
 */
export function buildOrderDrafts(
  summary: CartSummary,
  options: { commissionRateBpsFor: (supplierId: string) => number },
): Array<{
  supplierId: string;
  fulfilmentMethod: FulfilmentMethod;
  subtotalMinor: number;
  deliveryFeeMinor: number;
  totalMinor: number;
  commissionRateBps: number;
  commissionMinor: number;
  items: Array<{
    productId: string;
    productName: string;
    brand: string | null;
    unit: ProductUnit;
    unitPriceMinor: number;
    quantity: number;
    lineTotalMinor: number;
  }>;
}> {
  return summary.groups.map((group) => {
    const commissionRateBps = options.commissionRateBpsFor(group.supplier.id);
    return {
      supplierId: group.supplier.id,
      fulfilmentMethod: group.fulfilmentMethod,
      subtotalMinor: group.subtotalMinor,
      deliveryFeeMinor: group.deliveryFeeMinor,
      totalMinor: group.totalMinor,
      commissionRateBps,
      commissionMinor: Math.round((group.subtotalMinor * commissionRateBps) / 10_000),
      items: group.lines.map((line) => ({
        productId: line.productId,
        productName: line.productName,
        brand: line.brand,
        unit: line.unit,
        unitPriceMinor: line.unitPriceMinor,
        quantity: line.quantity,
        lineTotalMinor: line.lineTotalMinor,
      })),
    };
  });
}
