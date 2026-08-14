import { z } from "zod";
import { optionalText, uuidSchema } from "@/lib/validation/shared";
import { MAX_AMOUNT_MINOR } from "@/lib/money";

/**
 * Marketplace search and cart input.
 *
 * Search state lives entirely in the URL, so a filtered result set is
 * shareable, cacheable and survives the back button. `parseSearchParams`
 * therefore has to treat every value as hostile and fall back to a sane default
 * rather than throwing — a bad query string should show results, not an error.
 */

export const PRODUCT_SORTS = [
  "relevance",
  "price_asc",
  "price_desc",
  "rating",
  "newest",
  "nearest",
] as const;

export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const PRODUCT_SORT_LABELS: Record<ProductSort, string> = {
  relevance: "Most relevant",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  rating: "Best rated suppliers",
  newest: "Recently listed",
  nearest: "Nearest to me",
};

export type ProductSearchParams = {
  q: string | null;
  categorySlug: string | null;
  provinceId: string | null;
  districtId: string | null;
  supplierSlug: string | null;
  minPriceMinor: number | null;
  maxPriceMinor: number | null;
  verifiedOnly: boolean;
  inStockOnly: boolean;
  deliveryOnly: boolean;
  sort: ProductSort;
  page: number;
};

function first(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

function money(value: string | string[] | undefined): number | null {
  const raw = first(value);
  if (raw === null) return null;
  const parsed = Number.parseFloat(raw.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.min(Math.round(parsed * 100), MAX_AMOUNT_MINOR);
}

function flag(value: string | string[] | undefined): boolean {
  return first(value) === "1";
}

function uuid(value: string | string[] | undefined): string | null {
  const raw = first(value);
  if (raw === null) return null;
  return z.uuid().safeParse(raw).success ? raw : null;
}

/** URL query string to a validated search request. Never throws. */
export function parseSearchParams(
  params: Record<string, string | string[] | undefined>,
): ProductSearchParams {
  const sortRaw = first(params.sort);
  const sort = (PRODUCT_SORTS as readonly string[]).includes(sortRaw ?? "")
    ? (sortRaw as ProductSort)
    : "relevance";

  const pageRaw = Number.parseInt(first(params.page) ?? "1", 10);
  const minPriceMinor = money(params.min);
  const maxPriceMinor = money(params.max);

  return {
    q: first(params.q)?.slice(0, 100) ?? null,
    categorySlug: first(params.category)?.slice(0, 80) ?? null,
    provinceId: uuid(params.province),
    districtId: uuid(params.district),
    supplierSlug: first(params.supplier)?.slice(0, 120) ?? null,
    // Swapped bounds are a slip, not an attack: read them the way they were meant.
    minPriceMinor:
      minPriceMinor !== null && maxPriceMinor !== null
        ? Math.min(minPriceMinor, maxPriceMinor)
        : minPriceMinor,
    maxPriceMinor:
      minPriceMinor !== null && maxPriceMinor !== null
        ? Math.max(minPriceMinor, maxPriceMinor)
        : maxPriceMinor,
    verifiedOnly: flag(params.verified),
    inStockOnly: flag(params.stock),
    deliveryOnly: flag(params.delivery),
    sort,
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? Math.min(pageRaw, 500) : 1,
  };
}

/** Rebuilds a marketplace URL with one value changed. */
export function buildSearchHref(
  current: ProductSearchParams,
  changes: Partial<Record<string, string | number | boolean | null>>,
  basePath = "/marketplace",
): string {
  const query = new URLSearchParams();

  const base: Record<string, string | null> = {
    q: current.q,
    category: current.categorySlug,
    province: current.provinceId,
    district: current.districtId,
    supplier: current.supplierSlug,
    min: current.minPriceMinor !== null ? String(current.minPriceMinor / 100) : null,
    max: current.maxPriceMinor !== null ? String(current.maxPriceMinor / 100) : null,
    verified: current.verifiedOnly ? "1" : null,
    stock: current.inStockOnly ? "1" : null,
    delivery: current.deliveryOnly ? "1" : null,
    sort: current.sort === "relevance" ? null : current.sort,
    page: current.page > 1 ? String(current.page) : null,
  };

  for (const [key, value] of Object.entries({ ...base, ...normalise(changes) })) {
    if (value !== null && value !== undefined && value !== "") query.set(key, String(value));
  }

  const search = query.toString();
  return search ? `${basePath}?${search}` : basePath;
}

function normalise(
  changes: Partial<Record<string, string | number | boolean | null>>,
): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === undefined || value === false) result[key] = null;
    else if (value === true) result[key] = "1";
    else result[key] = String(value);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

export const cartQuantitySchema = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100_000) {
      ctx.addIssue({ code: "custom", message: "Enter a whole quantity of at least 1." });
      return z.NEVER;
    }
    return parsed;
  });

export const addToCartSchema = z.object({
  productId: uuidSchema,
  quantity: cartQuantitySchema,
  projectId: z
    .string()
    .transform((value) => (value.trim() === "" ? null : value.trim()))
    .nullable()
    .optional()
    .superRefine((value, ctx) => {
      if (value && !z.uuid().safeParse(value).success) {
        ctx.addIssue({ code: "custom", message: "Choose a project from the list." });
      }
    }),
});

export const updateCartItemSchema = z.object({
  itemId: uuidSchema,
  quantity: cartQuantitySchema,
});

export const removeCartItemSchema = z.object({ itemId: uuidSchema });

export const setCartProjectSchema = z.object({
  projectId: z
    .string()
    .transform((value) => (value.trim() === "" ? null : value.trim()))
    .nullable()
    .superRefine((value, ctx) => {
      if (value && !z.uuid().safeParse(value).success) {
        ctx.addIssue({ code: "custom", message: "Choose a project from the list." });
      }
    }),
});

/** A sub-rating the customer can skip — only the overall star rating is required. */
const optionalRating = z
  .union([z.string(), z.number()])
  .transform((value) => (typeof value === "string" && value.trim() === "" ? null : value))
  .nullable()
  .optional()
  .transform((value, ctx) => {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
      ctx.addIssue({ code: "custom", message: "Ratings run from 1 to 5 stars." });
      return z.NEVER;
    }
    return parsed;
  });

export const reviewSchema = z.object({
  orderId: uuidSchema,
  rating: z.coerce
    .number()
    .int("Choose a rating.")
    .min(1, "Choose a rating.")
    .max(5, "Ratings run from 1 to 5 stars."),
  productQualityRating: optionalRating,
  priceRating: optionalRating,
  deliveryRating: optionalRating,
  communicationRating: optionalRating,
  reliabilityRating: optionalRating,
  comment: optionalText(1500),
});
