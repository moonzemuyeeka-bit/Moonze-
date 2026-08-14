import { z } from "zod";
import { dateKeySchema, timeSchema } from "@/schemas/booking";

export const adminLoginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  next: z.string().optional(),
});

/** Prices are entered in Kwacha and converted to ngwee before storage. */
export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Give the service a name.").max(60),
  description: z.string().trim().min(4, "Add a short description.").max(300),
  priceKwacha: z.coerce
    .number()
    .min(0, "Price cannot be negative.")
    .max(100_000, "That price looks too high."),
  priceFrom: z.boolean().default(false),
  durationMinutes: z.coerce
    .number()
    .int()
    .min(15, "Appointments are at least 15 minutes.")
    .max(600, "Appointments are at most 10 hours."),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
});

export const availabilitySchema = z.object({
  date: dateKeySchema,
  status: z.enum(["AVAILABLE", "UNAVAILABLE"]),
  reason: z.string().trim().max(120).optional(),
});

export const timeSlotSchema = z
  .object({
    date: dateKeySchema,
    startTime: timeSchema,
    endTime: timeSchema,
    status: z.enum(["OPEN", "BLOCKED"]).default("OPEN"),
    note: z.string().trim().max(120).optional(),
  })
  .refine((value) => value.startTime < value.endTime, {
    path: ["endTime"],
    message: "The end time must be after the start time.",
  });

export const timeSlotUpdateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["OPEN", "BLOCKED"]),
});

export const bookingStatusSchema = z.object({
  reference: z.string().trim().min(4),
  status: z.enum(["PENDING_PAYMENT", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]),
  reason: z.string().trim().max(200).optional(),
});

export const workingHoursSchema = z.object({
  days: z
    .array(
      z
        .object({
          dayOfWeek: z.coerce.number().int().min(0).max(6),
          openTime: timeSchema,
          closeTime: timeSchema,
          closed: z.boolean(),
        })
        .refine((day) => day.closed || day.openTime < day.closeTime, {
          path: ["closeTime"],
          message: "Closing time must be after opening time.",
        }),
    )
    .length(7, "Provide all seven days."),
});

export const settingsSchema = z.object({
  businessName: z.string().trim().min(2).max(60),
  businessPhone: z.string().trim().min(6).max(24),
  businessEmail: z.string().trim().email("Enter a valid email address."),
  depositKwacha: z.coerce.number().min(0).max(10_000),
  slotIntervalMinutes: z.coerce.number().int().min(15).max(240),
  bufferMinutes: z.coerce.number().int().min(0).max(120),
  bookingWindowDays: z.coerce.number().int().min(1).max(365),
  minNoticeHours: z.coerce.number().int().min(0).max(72),
  reservationMinutes: z.coerce.number().int().min(2).max(60),
  maxDailyBookings: z.coerce.number().int().min(1).max(40),
  depositPolicy: z.string().trim().min(20).max(2_000),
  cancellationPolicy: z.string().trim().min(10).max(2_000),
  notifyWhatsapp: z.boolean(),
  notifySms: z.boolean(),
  notifyEmail: z.boolean(),
  reminderDayBefore: z.boolean(),
  reminderHoursBefore: z.coerce.number().int().min(0).max(48),
});

export type ServiceFormValues = z.input<typeof serviceSchema>;
export type SettingsFormValues = z.input<typeof settingsSchema>;
