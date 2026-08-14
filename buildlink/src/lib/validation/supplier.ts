import { z } from "zod";
import {
  checkboxSchema,
  nonNegativeIntSchema,
  optionalText,
  optionalZambianPhoneSchema,
  optionalZmwAmountSchema,
  positiveIntSchema,
  requiredText,
  uuidSchema,
  zambianPhoneSchema,
  zmwAmountSchema,
} from "@/lib/validation/shared";
import { emailSchema } from "@/lib/validation/shared";
import { PRODUCT_UNITS, SUPPLIER_DOCUMENT_TYPES } from "@/lib/labels";

/**
 * Supplier console input.
 *
 * A listing is a public commercial offer, so the schema is strict about the
 * things a customer will hold the supplier to — price, unit, minimum order and
 * stock — and lenient about everything else. Prices arrive as typed kwacha and
 * leave as integer ngwee.
 */

export const productUnitSchema = z.enum(PRODUCT_UNITS);
export const supplierDocumentTypeSchema = z.enum(SUPPLIER_DOCUMENT_TYPES);

/** Whether the supplier is saving a draft or putting the listing up for review. */
export const PRODUCT_INTENTS = ["draft", "publish"] as const;
export type ProductIntent = (typeof PRODUCT_INTENTS)[number];

export const productSchema = z
  .object({
    productId: z
      .string()
      .transform((value) => (value.trim() === "" ? null : value.trim()))
      .nullable()
      .optional(),
    categoryId: uuidSchema,
    name: requiredText("Product name", 160, 3),
    brand: optionalText(80),
    description: optionalText(2000),
    unit: productUnitSchema,
    priceMinor: zmwAmountSchema("Price", { min: 1 }),
    minimumOrderQuantity: positiveIntSchema("Minimum order", 100_000),
    stockQuantity: nonNegativeIntSchema("Stock on hand", 10_000_000),
    lowStockThreshold: nonNegativeIntSchema("Low stock alert", 10_000_000),
    deliveryAvailable: checkboxSchema,
    intent: z.enum(PRODUCT_INTENTS).default("publish"),
  })
  .superRefine((value, ctx) => {
    // A threshold above the quantity held would put a listing permanently in
    // "low stock", which trains suppliers to ignore the warning.
    if (value.lowStockThreshold > value.stockQuantity && value.stockQuantity > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["lowStockThreshold"],
        message: "The low-stock alert should be at or below the stock you hold.",
      });
    }
  });

export const productStatusSchema = z.object({
  productId: uuidSchema,
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]),
});

/**
 * A stock correction, recorded as a new level plus the reason it changed.
 * Suppliers count what is in the yard; they do not compute deltas.
 */
export const stockAdjustmentSchema = z.object({
  productId: uuidSchema,
  quantityOnHand: nonNegativeIntSchema("Stock on hand", 10_000_000),
  reason: optionalText(200),
});

export const productImageSchema = z.object({
  productId: uuidSchema,
  altText: optionalText(160),
});

export const removeProductImageSchema = z.object({ imageId: uuidSchema });

export const supplierDocumentUploadSchema = z.object({
  type: supplierDocumentTypeSchema,
});

export const removeSupplierDocumentSchema = z.object({ documentId: uuidSchema });

export const supplierSettingsSchema = z
  .object({
    businessName: requiredText("Business name", 160, 2),
    description: optionalText(1200),
    phone: zambianPhoneSchema,
    email: emailSchema,
    provinceId: uuidSchema,
    districtId: z
      .string()
      .transform((value) => (value.trim() === "" ? null : value.trim()))
      .nullable()
      .optional()
      .superRefine((value, ctx) => {
        if (value && !z.uuid().safeParse(value).success) {
          ctx.addIssue({ code: "custom", message: "Choose a district from the list." });
        }
      }),
    address: optionalText(240),
    yearsOperating: z
      .union([z.string(), z.number()])
      .transform((value) => (typeof value === "string" && value.trim() === "" ? null : value))
      .nullable()
      .optional()
      .transform((value, ctx) => {
        if (value === null || value === undefined) return null;
        const parsed = nonNegativeIntSchema("Years operating", 120).safeParse(value);
        if (!parsed.success) {
          ctx.addIssue({ code: "custom", message: "Years operating must be a whole number." });
          return z.NEVER;
        }
        return parsed.data;
      }),
    registrationNumber: optionalText(60),
    taxpayerNumber: optionalText(60),
    contactPhone: optionalZambianPhoneSchema,
    deliveryAvailable: checkboxSchema,
    deliveryNotes: optionalText(600),
    minimumOrderMinor: zmwAmountSchema("Minimum order"),
    deliveryBaseFeeMinor: zmwAmountSchema("Delivery fee"),
    deliveryFreeAboveMinor: optionalZmwAmountSchema("Free delivery threshold"),
    categoryIds: z
      .union([z.string(), z.array(z.string())])
      .transform((value) => (Array.isArray(value) ? value : [value]))
      .transform((values) => values.filter((value) => value.trim() !== ""))
      .pipe(z.array(uuidSchema).min(1, "Choose at least one category you supply.")),
  })
  .superRefine((value, ctx) => {
    if (
      value.deliveryFreeAboveMinor !== null &&
      value.deliveryBaseFeeMinor === 0 &&
      value.deliveryFreeAboveMinor > 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["deliveryFreeAboveMinor"],
        message: "You already deliver free of charge, so there is no threshold to set.",
      });
    }
  });

/** The supplier's own agreement, drafted from an order they have received. */
export const supplierAgreementSchema = z.object({
  orderId: uuidSchema,
  depositMinor: optionalZmwAmountSchema("Deposit"),
  deliveryDate: optionalText(40),
  deliveryLocation: optionalText(240),
  notes: optionalText(1000),
});
