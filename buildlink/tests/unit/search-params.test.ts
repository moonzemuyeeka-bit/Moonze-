import { describe, expect, it } from "vitest";
import {
  addToCartSchema,
  buildSearchHref,
  cartQuantitySchema,
  parseSearchParams,
  PRODUCT_SORT_LABELS,
  PRODUCT_SORTS,
  reviewSchema,
} from "@/lib/validation/marketplace";
import { MAX_AMOUNT_MINOR } from "@/lib/money";

const UUID = "6f2b6d1e-6c1e-4c5e-9b1e-2f1a3b4c5d6e";

describe("parseSearchParams", () => {
  it("defaults an empty query string to a safe first page", () => {
    const parsed = parseSearchParams({});
    expect(parsed).toMatchObject({
      q: null,
      categorySlug: null,
      provinceId: null,
      minPriceMinor: null,
      maxPriceMinor: null,
      verifiedOnly: false,
      inStockOnly: false,
      deliveryOnly: false,
      sort: "relevance",
      page: 1,
    });
  });

  it("reads prices in kwacha and stores them as ngwee", () => {
    const parsed = parseSearchParams({ min: "150", max: "2,500.50" });
    expect(parsed.minPriceMinor).toBe(15_000);
    expect(parsed.maxPriceMinor).toBe(250_050);
  });

  it("reads swapped price bounds the way they were meant", () => {
    const parsed = parseSearchParams({ min: "900", max: "100" });
    expect(parsed.minPriceMinor).toBe(10_000);
    expect(parsed.maxPriceMinor).toBe(90_000);
  });

  it("caps an absurd price rather than overflowing the column", () => {
    expect(parseSearchParams({ max: "999999999999" }).maxPriceMinor).toBe(MAX_AMOUNT_MINOR);
  });

  it("shows results rather than erroring on hostile input", () => {
    const parsed = parseSearchParams({
      sort: "'; drop table products; --",
      page: "-5",
      province: "not-a-uuid",
      district: "../../etc/passwd",
      min: "abc",
      verified: "yes",
    });

    expect(parsed.sort).toBe("relevance");
    expect(parsed.page).toBe(1);
    expect(parsed.provinceId).toBeNull();
    expect(parsed.districtId).toBeNull();
    expect(parsed.minPriceMinor).toBeNull();
    // Only an explicit "1" turns a flag on.
    expect(parsed.verifiedOnly).toBe(false);
  });

  it("accepts valid uuids for location filters", () => {
    const parsed = parseSearchParams({ province: UUID, district: UUID });
    expect(parsed.provinceId).toBe(UUID);
    expect(parsed.districtId).toBe(UUID);
  });

  it("takes the first value when a parameter repeats, and trims it", () => {
    const parsed = parseSearchParams({ q: ["  cement  ", "blocks"] });
    expect(parsed.q).toBe("cement");
  });

  it("truncates an overlong query instead of passing it to the database", () => {
    const parsed = parseSearchParams({ q: "x".repeat(500) });
    expect(parsed.q).toHaveLength(100);
  });

  it("clamps the page number to a sane range", () => {
    expect(parseSearchParams({ page: "1000000" }).page).toBe(500);
    expect(parseSearchParams({ page: "3" }).page).toBe(3);
  });

  it("accepts every declared sort mode and labels it", () => {
    for (const sort of PRODUCT_SORTS) {
      expect(parseSearchParams({ sort }).sort).toBe(sort);
      expect(PRODUCT_SORT_LABELS[sort].length).toBeGreaterThan(0);
    }
  });

  it("turns flags on for an explicit 1", () => {
    const parsed = parseSearchParams({ verified: "1", stock: "1", delivery: "1" });
    expect(parsed.verifiedOnly).toBe(true);
    expect(parsed.inStockOnly).toBe(true);
    expect(parsed.deliveryOnly).toBe(true);
  });
});

describe("buildSearchHref", () => {
  it("keeps the current filters and changes only what was asked", () => {
    const current = parseSearchParams({ q: "cement", category: "cement-concrete", verified: "1" });
    const href = buildSearchHref(current, { sort: "price_asc" });
    const query = new URL(href, "https://buildlink.test").searchParams;

    expect(query.get("q")).toBe("cement");
    expect(query.get("category")).toBe("cement-concrete");
    expect(query.get("verified")).toBe("1");
    expect(query.get("sort")).toBe("price_asc");
  });

  it("drops a filter when it is cleared", () => {
    const current = parseSearchParams({ q: "cement", verified: "1", page: "4" });
    const href = buildSearchHref(current, { verified: false, page: null });

    expect(href).not.toContain("verified");
    expect(href).not.toContain("page");
    expect(href).toContain("q=cement");
  });

  it("omits defaults so a clean search has a clean URL", () => {
    expect(buildSearchHref(parseSearchParams({}), {})).toBe("/marketplace");
  });

  it("round-trips through parseSearchParams unchanged", () => {
    const original = parseSearchParams({
      q: "roof sheets",
      category: "roofing",
      min: "150",
      max: "900",
      stock: "1",
      sort: "price_desc",
      page: "2",
    });
    const href = buildSearchHref(original, {});
    const query = new URL(href, "https://buildlink.test").searchParams;
    const reparsed = parseSearchParams(Object.fromEntries(query.entries()));

    expect(reparsed).toEqual(original);
  });

  it("writes to another base path for supplier and category pages", () => {
    const href = buildSearchHref(parseSearchParams({ q: "sand" }), {}, "/marketplace/suppliers");
    expect(href.startsWith("/marketplace/suppliers?")).toBe(true);
  });
});

describe("cart input", () => {
  it("accepts a whole positive quantity from a form field", () => {
    expect(cartQuantitySchema.parse("25")).toBe(25);
    expect(cartQuantitySchema.parse(1)).toBe(1);
  });

  it("rejects zero, fractions, negatives and absurd quantities", () => {
    for (const value of ["0", "-3", "2.5", "1000000", "", "many"]) {
      expect(cartQuantitySchema.safeParse(value).success, `accepted ${value}`).toBe(false);
    }
  });

  it("requires a real product id", () => {
    expect(addToCartSchema.safeParse({ productId: "1", quantity: "2" }).success).toBe(false);
    expect(addToCartSchema.safeParse({ productId: UUID, quantity: "2" }).success).toBe(true);
  });

  it("treats a blank project selection as no project", () => {
    const parsed = addToCartSchema.parse({ productId: UUID, quantity: "2", projectId: "" });
    expect(parsed.projectId).toBeNull();
  });

  it("rejects a malformed project id", () => {
    expect(
      addToCartSchema.safeParse({ productId: UUID, quantity: "2", projectId: "nope" }).success,
    ).toBe(false);
  });
});

describe("review input", () => {
  it("requires an overall rating but allows the sub-ratings to be skipped", () => {
    const parsed = reviewSchema.parse({
      orderId: UUID,
      rating: "5",
      productQualityRating: "",
      comment: "",
    });

    expect(parsed.rating).toBe(5);
    expect(parsed.productQualityRating).toBeNull();
    expect(parsed.comment).toBeNull();
  });

  it("rejects out-of-range stars", () => {
    expect(reviewSchema.safeParse({ orderId: UUID, rating: "0" }).success).toBe(false);
    expect(reviewSchema.safeParse({ orderId: UUID, rating: "6" }).success).toBe(false);
    expect(reviewSchema.safeParse({ orderId: UUID, rating: "3", priceRating: "9" }).success).toBe(
      false,
    );
  });
});
