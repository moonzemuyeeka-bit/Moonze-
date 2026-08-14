import { z } from "zod";
import { isValidZambianMobile, normalisePhone } from "@/lib/phone";
import { isDateKey, isTimeString } from "@/lib/time";

/**
 * Validation schemas shared by the browser forms and the server. The server
 * always re-validates: client-side checks are a convenience, never a control.
 */

export const dateKeySchema = z
  .string()
  .refine(isDateKey, "Choose a valid date (YYYY-MM-DD).");

export const timeSchema = z
  .string()
  .refine(isTimeString, "Choose a valid time (HH:mm).");

export const phoneSchema = z
  .string()
  .min(1, "Phone number is required.")
  .refine(isValidZambianMobile, "Enter a Zambian mobile number, e.g. +260 97X XXX XXX.")
  .transform((value) => normalisePhone(value) as string);

export const customerDetailsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please enter your full name.")
    .max(80, "That name is too long."),
  phone: phoneSchema,
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(120)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  notes: z
    .string()
    .trim()
    .max(500, "Please keep notes under 500 characters.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type CustomerDetailsInput = z.input<typeof customerDetailsSchema>;
export type CustomerDetails = z.output<typeof customerDetailsSchema>;

export const createBookingSchema = z.object({
  serviceId: z.string().min(1, "Choose a service."),
  date: dateKeySchema,
  startTime: timeSchema,
  customer: customerDetailsSchema,
  policyAccepted: z.literal(true, {
    message: "You must accept the booking policy before paying the deposit.",
  }),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const bookingLookupSchema = z.object({
  reference: z
    .string()
    .trim()
    .min(4, "Enter your booking reference, e.g. KOKO-8F42A1.")
    .max(20),
  phone: phoneSchema,
});

export const initiatePaymentSchema = z
  .object({
    bookingReference: z.string().trim().min(4),
    method: z.enum(["MOBILE_MONEY", "BANK_CARD"]),
    mobileMoney: z
      .object({
        provider: z.enum(["airtel", "mtn", "zamtel"]).optional(),
        phone: phoneSchema.optional(),
      })
      .optional(),
    card: z.object({ token: z.string().min(4) }).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.method === "BANK_CARD" && !value.card?.token) {
      ctx.addIssue({
        code: "custom",
        path: ["card"],
        message: "Choose a card to pay with.",
      });
    }
    if (value.method === "MOBILE_MONEY" && !value.mobileMoney?.provider) {
      ctx.addIssue({
        code: "custom",
        path: ["mobileMoney", "provider"],
        message: "Choose your mobile money provider.",
      });
    }
  });

export const sandboxSettleSchema = z.object({
  paymentId: z.string().min(1),
  outcome: z.enum(["approve", "decline", "cancel"]),
});

export const cancelBookingSchema = z.object({
  reference: z.string().trim().min(4),
  phone: phoneSchema,
  reason: z.string().trim().max(200).optional(),
});
