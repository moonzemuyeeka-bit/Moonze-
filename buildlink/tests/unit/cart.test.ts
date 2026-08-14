import { describe, expect, it } from "vitest";
import {
  buildOrderDrafts,
  deliveryFeeFor,
  summariseCart,
  type CartLineInput,
  type CartSupplierInput,
} from "@/lib/domain/cart";

function supplier(overrides: Partial<CartSupplierInput> = {}): CartSupplierInput {
  return {
    id: "supplier-a",
    businessName: "Alpha Hardware",
    slug: "alpha-hardware",
    verificationStatus: "VERIFIED",
    isDemo: true,
    deliveryAvailable: true,
    minimumOrderMinor: 0,
    deliveryBaseFeeMinor: 25_000,
    deliveryFreeAboveMinor: null,
    provinceName: "Lusaka",
    districtName: "Lusaka",
    ...overrides,
  };
}

function line(overrides: Partial<CartLineInput> = {}): CartLineInput {
  return {
    itemId: "item-1",
    productId: "product-1",
    productName: "Cement 32.5N 50kg",
    brand: "Lafarge",
    unit: "BAG",
    unitPriceMinor: 24_000,
    quantity: 10,
    minimumOrderQuantity: 1,
    stockQuantity: 500,
    isAvailable: true,
    imageKey: null,
    supplier: supplier(),
    ...overrides,
  };
}

describe("deliveryFeeFor", () => {
  it("charges the supplier's flat fee for supplier delivery", () => {
    expect(deliveryFeeFor(supplier(), 100_000, "SUPPLIER_DELIVERY")).toBe(25_000);
  });

  it("waives the fee above the free-delivery threshold", () => {
    const yard = supplier({ deliveryFreeAboveMinor: 500_000 });
    expect(deliveryFeeFor(yard, 499_999, "SUPPLIER_DELIVERY")).toBe(25_000);
    expect(deliveryFeeFor(yard, 500_000, "SUPPLIER_DELIVERY")).toBe(0);
  });

  it("is free for pickup, and quoted later for third-party delivery", () => {
    expect(deliveryFeeFor(supplier(), 100_000, "CUSTOMER_PICKUP")).toBe(0);
    expect(deliveryFeeFor(supplier(), 100_000, "THIRD_PARTY_DELIVERY")).toBe(0);
  });

  it("charges nothing when the supplier does not deliver at all", () => {
    expect(
      deliveryFeeFor(supplier({ deliveryAvailable: false }), 100_000, "SUPPLIER_DELIVERY"),
    ).toBe(0);
  });
});

describe("summariseCart", () => {
  it("splits lines into one basket per supplier and totals each", () => {
    const beta = supplier({
      id: "supplier-b",
      businessName: "Beta Quarry",
      slug: "beta-quarry",
      deliveryBaseFeeMinor: 40_000,
    });

    const summary = summariseCart([
      line({ itemId: "i1", unitPriceMinor: 24_000, quantity: 10 }),
      line({ itemId: "i2", productId: "product-2", unitPriceMinor: 10_000, quantity: 2 }),
      line({ itemId: "i3", productId: "product-3", supplier: beta, unitPriceMinor: 90_000, quantity: 3 }),
    ]);

    expect(summary.supplierCount).toBe(2);
    expect(summary.lineCount).toBe(3);
    expect(summary.itemCount).toBe(15);
    expect(summary.subtotalMinor).toBe(24_000 * 10 + 10_000 * 2 + 90_000 * 3);
    expect(summary.deliveryFeeMinor).toBe(25_000 + 40_000);
    expect(summary.totalMinor).toBe(summary.subtotalMinor + summary.deliveryFeeMinor);
    expect(summary.isCheckoutable).toBe(true);
  });

  it("orders baskets by supplier name so the cart is stable between renders", () => {
    const zulu = supplier({ id: "supplier-z", businessName: "Zulu Timber", slug: "zulu-timber" });
    const summary = summariseCart([
      line({ itemId: "i1", supplier: zulu }),
      line({ itemId: "i2" }),
    ]);
    expect(summary.groups.map((group) => group.supplier.businessName)).toEqual([
      "Alpha Hardware",
      "Zulu Timber",
    ]);
  });

  it("blocks checkout below a supplier minimum order and reports the shortfall", () => {
    const summary = summariseCart([
      line({ unitPriceMinor: 10_000, quantity: 1, supplier: supplier({ minimumOrderMinor: 50_000 }) }),
    ]);

    expect(summary.isCheckoutable).toBe(false);
    expect(summary.groups[0]?.issues).toEqual([
      { kind: "below_minimum_order", shortfallMinor: 40_000, minimumOrderMinor: 50_000 },
    ]);
  });

  it("flags stock, minimum-quantity and availability problems per line", () => {
    const summary = summariseCart([
      line({ itemId: "i1", quantity: 900, stockQuantity: 12 }),
      line({ itemId: "i2", productId: "p2", quantity: 1, minimumOrderQuantity: 5 }),
      line({ itemId: "i3", productId: "p3", isAvailable: false }),
    ]);

    const kinds = summary.groups[0]?.lines.flatMap((l) => l.issues.map((issue) => issue.kind));
    expect(kinds).toEqual(
      expect.arrayContaining(["insufficient_stock", "below_minimum_quantity", "unavailable"]),
    );
    expect(summary.isCheckoutable).toBe(false);
    expect(summary.blockingIssueCount).toBeGreaterThanOrEqual(3);
  });

  it("defaults fulfilment to pickup when a supplier does not deliver", () => {
    const summary = summariseCart([line({ supplier: supplier({ deliveryAvailable: false }) })]);
    expect(summary.groups[0]?.fulfilmentMethod).toBe("CUSTOMER_PICKUP");
    expect(summary.groups[0]?.issues).toEqual([]);
  });

  it("honours an explicit per-supplier fulfilment choice", () => {
    const summary = summariseCart([line()], { "supplier-a": "CUSTOMER_PICKUP" });
    expect(summary.groups[0]?.fulfilmentMethod).toBe("CUSTOMER_PICKUP");
    expect(summary.groups[0]?.deliveryFeeMinor).toBe(0);
  });

  it("treats an empty cart as not checkoutable", () => {
    const summary = summariseCart([]);
    expect(summary.isCheckoutable).toBe(false);
    expect(summary.totalMinor).toBe(0);
  });
});

describe("buildOrderDrafts", () => {
  it("produces one order draft per supplier with a commission snapshot", () => {
    const summary = summariseCart([line({ unitPriceMinor: 100_000, quantity: 10 })]);
    const drafts = buildOrderDrafts(summary, { commissionRateBpsFor: () => 500 });

    expect(drafts).toHaveLength(1);
    const draft = drafts[0]!;
    expect(draft.supplierId).toBe("supplier-a");
    expect(draft.subtotalMinor).toBe(1_000_000);
    expect(draft.deliveryFeeMinor).toBe(25_000);
    expect(draft.totalMinor).toBe(1_025_000);
    expect(draft.commissionRateBps).toBe(500);
    // Commission is charged on goods, never on the delivery fee.
    expect(draft.commissionMinor).toBe(50_000);
    expect(draft.items[0]?.lineTotalMinor).toBe(1_000_000);
  });
});
