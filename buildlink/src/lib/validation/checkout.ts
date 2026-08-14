import { z } from "zod";
import {
  optionalDateSchema,
  optionalText,
  requiredText,
  uuidSchema,
  zambianPhoneSchema,
  zmwAmountSchema,
} from "@/lib/validation/shared";
import { FULFILMENT_METHODS, ORDER_STATUSES } from "@/lib/labels";

/**
 * Checkout, payment and agreement input.
 *
 * Checkout is the point where BuildLink stops being a catalogue and starts
 * creating commitments, so every figure is recomputed on the server from the
 * cart and the supplier's own settings. The client sends choices — which
 * supplier gets which fulfilment method, where to deliver — never prices.
 */

export const fulfilmentMethodSchema = z.enum(FULFILMENT_METHODS);
export const orderStatusSchema = z.enum(ORDER_STATUSES);

/**
 * A per-supplier fulfilment choice arrives as repeated `fulfilment` fields of
 * the form `<supplierId>:<method>`, which keeps the form a plain HTML form (no
 * JSON payload, so it degrades without JavaScript).
 */
const fulfilmentSelectionSchema = z
  .array(z.string())
  .default([])
  .transform((entries, ctx) => {
    const selection: Record<string, z.infer<typeof fulfilmentMethodSchema>> = {};

    for (const entry of entries) {
      const separator = entry.lastIndexOf(":");
      const supplierId = entry.slice(0, separator);
      const method = entry.slice(separator + 1);

      if (!z.uuid().safeParse(supplierId).success) {
        ctx.addIssue({ code: "custom", message: "That supplier is not recognised." });
        return z.NEVER;
      }
      const parsedMethod = fulfilmentMethodSchema.safeParse(method);
      if (!parsedMethod.success) {
        ctx.addIssue({ code: "custom", message: "Choose how each supplier should get you the goods." });
        return z.NEVER;
      }
      selection[supplierId] = parsedMethod.data;
    }

    return selection;
  });

export const checkoutSchema = z.object({
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
  fulfilment: fulfilmentSelectionSchema,

  // Delivery address. Required unless every basket is being collected, which
  // the action checks once it knows the fulfilment methods.
  addressLine: optionalText(300),
  provinceId: z
    .string()
    .transform((value) => (value.trim() === "" ? null : value.trim()))
    .nullable()
    .optional(),
  districtId: z
    .string()
    .transform((value) => (value.trim() === "" ? null : value.trim()))
    .nullable()
    .optional(),
  locationDetail: optionalText(300),
  contactName: requiredText("Contact name", 120, 2),
  contactPhone: zambianPhoneSchema,
  instructions: optionalText(600),
  customerNote: optionalText(600),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

/**
 * Only offline methods can be chosen here. A provider-processed payment is
 * started by `initiatePaymentAction`, which asks the provider rather than
 * trusting a form field.
 */
export const recordedPaymentMethodSchema = z.enum([
  "RECORDED_MOBILE_MONEY",
  "RECORDED_BANK_TRANSFER",
  "RECORDED_CASH",
]);

export const recordPaymentSchema = z.object({
  orderId: uuidSchema,
  method: recordedPaymentMethodSchema,
  amountMinor: zmwAmountSchema("Amount", { min: 1 }),
  reference: optionalText(120),
  note: optionalText(500),
});

export const initiatePaymentSchema = z.object({
  orderId: uuidSchema,
  amountMinor: zmwAmountSchema("Amount", { min: 1 }),
});

export const confirmPaymentSchema = z.object({
  paymentId: uuidSchema,
  note: optionalText(500),
});

export const rejectPaymentSchema = z.object({
  paymentId: uuidSchema,
  reason: requiredText("Reason", 500, 4),
});

/** Sandbox-only control that stands in for the customer's handset. */
export const sandboxSettleSchema = z.object({
  paymentId: uuidSchema,
  outcome: z.enum(["SUCCESSFUL", "FAILED"]),
});

/** Re-asks the provider what happened, for a customer who has paid on their phone. */
export const verifyPaymentSchema = z.object({ paymentId: uuidSchema });

export const refundPaymentSchema = z.object({
  paymentId: uuidSchema,
  reason: requiredText("Reason", 500, 4),
});

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export const orderStatusUpdateSchema = z.object({
  orderId: uuidSchema,
  status: orderStatusSchema,
  note: optionalText(500),
});

export const cancelOrderSchema = z.object({
  orderId: uuidSchema,
  reason: requiredText("Reason", 500, 4),
});

export const completeOrderSchema = z.object({
  orderId: uuidSchema,
});

// ---------------------------------------------------------------------------
// Agreements
// ---------------------------------------------------------------------------

export const createContractSchema = z.object({
  orderId: uuidSchema,
  depositMinor: zmwAmountSchema("Deposit"),
  deliveryDate: optionalDateSchema,
  deliveryLocation: optionalText(300),
  notes: optionalText(2000),
});

export const sendContractSchema = z.object({ contractId: uuidSchema });

export const respondToContractSchema = z.object({
  contractId: uuidSchema,
  decision: z.enum(["ACCEPT", "REJECT"]),
  /**
   * Typing your own name is the acceptance record. It is stored with the
   * contract version, the timestamp, the IP and the user agent so the agreement
   * can show exactly who agreed to what, and when.
   */
  signatureName: requiredText("Your full name", 120, 3),
  reason: optionalText(500),
});

export const cancelContractSchema = z.object({
  contractId: uuidSchema,
  reason: requiredText("Reason", 500, 4),
});
