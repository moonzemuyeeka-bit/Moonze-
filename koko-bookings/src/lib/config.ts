import { z } from "zod";

/**
 * Server-side configuration. Business *rules* live in the database
 * (see `lib/database/settings.ts`); this file only holds deployment
 * configuration and the fallbacks used before the database is seeded.
 */

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters"),
  PAYMENT_WEBHOOK_SECRET: z.string().min(16).default("koko-dev-webhook-secret"),
  PAYMENT_PROVIDER: z.string().default("mock"),
  DEMO_MODE: z
    .string()
    .default("true")
    .transform((value) => value !== "false"),
  CRON_SECRET: z.string().default("koko-dev-cron-secret"),
  NEXT_PUBLIC_SITE_URL: z.string().default("http://localhost:3000"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;

  const parsed = serverEnvSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    PAYMENT_WEBHOOK_SECRET: process.env.PAYMENT_WEBHOOK_SECRET,
    PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER,
    DEMO_MODE: process.env.DEMO_MODE,
    CRON_SECRET: process.env.CRON_SECRET,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration — ${issues}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function isDemoMode(): boolean {
  return serverEnv().DEMO_MODE;
}

/** Brand and copy constants that are not owner-configurable. */
export const BRAND = {
  name: "Koko's Bookings",
  tagline: "Beautiful lashes. Booked in seconds.",
  subheading:
    "Choose your look, pick your perfect time, and secure your appointment with a K50 deposit.",
  city: "Lusaka, Zambia",
} as const;

/**
 * Defaults used by the seed and as a safety net if the settings row is missing.
 * The owner can change every one of these from Admin → Settings.
 */
export const DEFAULT_SETTINGS = {
  businessName: BRAND.name,
  businessPhone: "+260 977 000 000",
  businessEmail: "hello@kokosbookings.zm",
  currency: "ZMW",
  timezone: "Africa/Lusaka",
  depositNgwee: 5000,
  slotIntervalMinutes: 30,
  bufferMinutes: 15,
  bookingWindowDays: 60,
  minNoticeHours: 2,
  reservationMinutes: 10,
  maxDailyBookings: 6,
  cancellationPolicy:
    "Appointments may be rescheduled up to 24 hours before the start time at no extra cost. The K50 deposit is non-refundable for cancellations or no-shows unless the business approves otherwise.",
  depositPolicy: [
    "A K50 deposit is required to secure your appointment slot.",
    "Your appointment is only confirmed after successful payment.",
    "The K50 deposit is non-refundable for cancellations or no-shows unless the business approves otherwise.",
    "Please ensure that you select the correct date, time and service before making payment.",
  ].join("\n"),
} as const;

export const DEFAULT_WORKING_HOURS = [
  { dayOfWeek: 0, openTime: "09:00", closeTime: "16:00", closed: true },
  { dayOfWeek: 1, openTime: "09:00", closeTime: "18:00", closed: false },
  { dayOfWeek: 2, openTime: "09:00", closeTime: "18:00", closed: false },
  { dayOfWeek: 3, openTime: "09:00", closeTime: "18:00", closed: false },
  { dayOfWeek: 4, openTime: "09:00", closeTime: "18:00", closed: false },
  { dayOfWeek: 5, openTime: "09:00", closeTime: "18:00", closed: false },
  { dayOfWeek: 6, openTime: "09:00", closeTime: "16:00", closed: false },
] as const;

export const SESSION_COOKIE_NAME = "koko_admin_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8;
