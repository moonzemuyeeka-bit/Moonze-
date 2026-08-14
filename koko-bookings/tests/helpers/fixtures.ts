import type { Service } from "@/generated/prisma";
import { DEFAULT_SETTINGS, DEFAULT_WORKING_HOURS } from "@/lib/config";
import { prisma } from "@/lib/database/client";
import { hashPassword } from "@/lib/auth/password";
import { SETTINGS_ID } from "@/lib/database/settings";
import { addDaysToDateKey, dayOfWeekForDateKey, type DateKey } from "@/lib/time";

const TABLES = [
  "payment_events",
  "payments",
  "reminders",
  "notifications",
  "bookings",
  "time_slots",
  "availability",
  "customers",
  "services",
  "users",
  "working_hours",
  "business_settings",
];

/** Empties every table so each suite starts from a known state. */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((table) => `"${table}"`).join(", ")} CASCADE`,
  );
}

export type BaselineOptions = {
  settings?: Partial<typeof DEFAULT_SETTINGS>;
  serviceOverrides?: Partial<Pick<Service, "priceNgwee" | "durationMinutes" | "name">>;
};

export type Baseline = {
  service: Service;
  removal: Service;
};

/**
 * The minimum a booking needs: business settings, a full week of working hours
 * and two services (a two-hour set and the K100 removal used to check that a
 * deposit never exceeds the price).
 */
export async function seedBaseline(options: BaselineOptions = {}): Promise<Baseline> {
  await prisma.businessSettings.create({
    data: { id: SETTINGS_ID, ...DEFAULT_SETTINGS, ...options.settings },
  });
  await prisma.workingHours.createMany({
    data: DEFAULT_WORKING_HOURS.map((day) => ({ ...day })),
  });

  const service = await prisma.service.create({
    data: {
      name: "Classic Lashes",
      slug: "classic-lashes",
      description: "Weightless one-to-one extensions.",
      priceNgwee: 28_000,
      durationMinutes: 120,
      active: true,
      sortOrder: 1,
      ...options.serviceOverrides,
    },
  });

  const removal = await prisma.service.create({
    data: {
      name: "Lash Removal",
      slug: "lash-removal",
      description: "Gentle removal of an existing set.",
      priceNgwee: 10_000,
      durationMinutes: 30,
      active: true,
      sortOrder: 2,
    },
  });

  return { service, removal };
}

export async function seedAdmin(
  email = "owner@kokosbookings.zm",
  password = "KokoLashes2026!",
) {
  return prisma.user.create({
    data: {
      name: "Koko",
      email,
      role: "ADMIN",
      passwordHash: await hashPassword(password),
    },
  });
}

/**
 * A trading day far enough ahead to clear the minimum-notice rule and inside the
 * booking window. Sundays are skipped because the salon is closed.
 */
export function tradingDateKey(daysAhead = 14): DateKey {
  let date = addDaysToDateKey(new Date().toISOString().slice(0, 10), daysAhead);
  while (dayOfWeekForDateKey(date) === 0) date = addDaysToDateKey(date, 1);
  return date;
}

export const CUSTOMER = {
  name: "Jane Doe",
  phone: "0977123456",
  email: "jane@example.com",
};

export const OTHER_CUSTOMER = {
  name: "Mercy Banda",
  phone: "0966555444",
  email: "mercy@example.com",
};
