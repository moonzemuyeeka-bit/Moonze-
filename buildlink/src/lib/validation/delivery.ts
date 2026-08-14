import { z } from "zod";
import {
  nonNegativeIntSchema,
  optionalText,
  requiredText,
  uuidSchema,
  zambianPhoneSchema,
  zmwAmountSchema,
} from "@/lib/validation/shared";
import { DELIVERY_STATUSES, VEHICLE_TYPES } from "@/lib/labels";

/**
 * Delivery, fleet and service-area input.
 *
 * The transporter's side of BuildLink is used from a phone, often in a truck, so
 * these schemas accept the smallest amount of typing that still produces a
 * record the customer and supplier can rely on.
 */

export const deliveryStatusSchema = z.enum(DELIVERY_STATUSES);
export const vehicleTypeSchema = z.enum(VEHICLE_TYPES);

export const assignDeliverySchema = z.object({
  deliveryId: uuidSchema,
  providerId: uuidSchema,
  vehicleId: z
    .string()
    .transform((value) => (value.trim() === "" ? null : value.trim()))
    .nullable()
    .optional()
    .superRefine((value, ctx) => {
      if (value && !z.uuid().safeParse(value).success) {
        ctx.addIssue({ code: "custom", message: "Choose a vehicle from the list." });
      }
    }),
  feeMinor: zmwAmountSchema("Delivery fee").optional(),
  scheduledFor: optionalText(40),
  note: optionalText(500),
});

/** A transporter taking a job that was offered to them. */
export const claimDeliverySchema = z.object({
  deliveryId: uuidSchema,
  vehicleId: z
    .string()
    .transform((value) => (value.trim() === "" ? null : value.trim()))
    .nullable()
    .optional()
    .superRefine((value, ctx) => {
      if (value && !z.uuid().safeParse(value).success) {
        ctx.addIssue({ code: "custom", message: "Choose a vehicle from the list." });
      }
    }),
});

export const deliveryStatusUpdateSchema = z.object({
  deliveryId: uuidSchema,
  status: deliveryStatusSchema,
  note: optionalText(500),
});

export const deliveryFailureSchema = z.object({
  deliveryId: uuidSchema,
  reason: requiredText("Reason", 500, 4),
});

/**
 * Completing a delivery. `receivedBy` is who signed for the goods on site, which
 * is the detail that settles most "it never arrived" arguments.
 */
export const completeDeliverySchema = z.object({
  deliveryId: uuidSchema,
  receivedBy: requiredText("Name of the person who received the goods", 120, 2),
  note: optionalText(500),
});

export const cancelDeliverySchema = z.object({
  deliveryId: uuidSchema,
  reason: requiredText("Reason", 500, 4),
});

// ---------------------------------------------------------------------------
// Fleet and service areas
// ---------------------------------------------------------------------------

export const vehicleSchema = z.object({
  vehicleId: z
    .string()
    .transform((value) => (value.trim() === "" ? null : value.trim()))
    .nullable()
    .optional(),
  type: vehicleTypeSchema,
  registration: requiredText("Registration", 20, 3).transform((value) => value.toUpperCase()),
  description: optionalText(200),
  capacityKg: z
    .union([z.string(), z.number()])
    .transform((value) => (typeof value === "string" && value.trim() === "" ? null : value))
    .nullable()
    .optional()
    .transform((value, ctx) => {
      if (value === null || value === undefined) return null;
      const parsed = nonNegativeIntSchema("Load capacity", 100_000).safeParse(value);
      if (!parsed.success) {
        ctx.addIssue({ code: "custom", message: "Load capacity must be a whole number of kg." });
        return z.NEVER;
      }
      return parsed.data;
    }),
  capacityCubicMetres: z
    .union([z.string(), z.number()])
    .transform((value) => (typeof value === "string" && value.trim() === "" ? null : value))
    .nullable()
    .optional()
    .transform((value, ctx) => {
      if (value === null || value === undefined) return null;
      const parsed = nonNegativeIntSchema("Volume capacity", 1_000).safeParse(value);
      if (!parsed.success) {
        ctx.addIssue({ code: "custom", message: "Volume must be a whole number of cubic metres." });
        return z.NEVER;
      }
      return parsed.data;
    }),
});

export const removeVehicleSchema = z.object({ vehicleId: uuidSchema });

export const serviceAreaSchema = z.object({
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
  feeMinor: zmwAmountSchema("Area fee"),
});

export const removeServiceAreaSchema = z.object({ serviceAreaId: uuidSchema });

export const deliveryProviderSettingsSchema = z.object({
  businessName: requiredText("Business name", 160, 2),
  phone: zambianPhoneSchema,
  description: optionalText(600),
  baseFeeMinor: zmwAmountSchema("Base fee"),
  perKilometreMinor: zmwAmountSchema("Rate per kilometre"),
  isAcceptingJobs: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.literal(""), z.boolean()])
    .optional()
    .transform((value) => value === "on" || value === "true" || value === true),
});
