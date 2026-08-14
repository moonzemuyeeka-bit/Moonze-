import type { BusinessSettings, WorkingHours } from "@/generated/prisma";
import { DEFAULT_SETTINGS, DEFAULT_WORKING_HOURS } from "@/lib/config";
import { prisma } from "@/lib/database/client";

export const SETTINGS_ID = "default";

export type BusinessConfig = BusinessSettings & {
  workingHours: WorkingHours[];
};

/**
 * Reads the owner-configurable business rules, creating the row from defaults
 * on first use so a fresh database is never in an unusable state.
 */
export async function getSettings(): Promise<BusinessSettings> {
  const existing = await prisma.businessSettings.findUnique({
    where: { id: SETTINGS_ID },
  });
  if (existing) return existing;

  return prisma.businessSettings.create({
    data: { id: SETTINGS_ID, ...DEFAULT_SETTINGS },
  });
}

export async function getWorkingHours(): Promise<WorkingHours[]> {
  const rows = await prisma.workingHours.findMany({ orderBy: { dayOfWeek: "asc" } });
  if (rows.length === 7) return rows;

  await prisma.$transaction(
    DEFAULT_WORKING_HOURS.map((day) =>
      prisma.workingHours.upsert({
        where: { dayOfWeek: day.dayOfWeek },
        update: {},
        create: { ...day },
      }),
    ),
  );
  return prisma.workingHours.findMany({ orderBy: { dayOfWeek: "asc" } });
}

export async function getBusinessConfig(): Promise<BusinessConfig> {
  const [settings, workingHours] = await Promise.all([getSettings(), getWorkingHours()]);
  return { ...settings, workingHours };
}

export type SettingsUpdate = Partial<
  Pick<
    BusinessSettings,
    | "businessName"
    | "businessPhone"
    | "businessEmail"
    | "timezone"
    | "depositNgwee"
    | "slotIntervalMinutes"
    | "bufferMinutes"
    | "bookingWindowDays"
    | "minNoticeHours"
    | "reservationMinutes"
    | "maxDailyBookings"
    | "cancellationPolicy"
    | "depositPolicy"
    | "notifyWhatsapp"
    | "notifySms"
    | "notifyEmail"
    | "reminderDayBefore"
    | "reminderHoursBefore"
  >
>;

export async function updateSettings(update: SettingsUpdate): Promise<BusinessSettings> {
  await getSettings();
  return prisma.businessSettings.update({ where: { id: SETTINGS_ID }, data: update });
}

export type WorkingHoursUpdate = {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  closed: boolean;
};

export async function updateWorkingHours(
  days: WorkingHoursUpdate[],
): Promise<WorkingHours[]> {
  await prisma.$transaction(
    days.map((day) =>
      prisma.workingHours.upsert({
        where: { dayOfWeek: day.dayOfWeek },
        update: { openTime: day.openTime, closeTime: day.closeTime, closed: day.closed },
        create: day,
      }),
    ),
  );
  return prisma.workingHours.findMany({ orderBy: { dayOfWeek: "asc" } });
}

/** The deposit policy as individual paragraphs for the policy card. */
export function policyParagraphs(settings: Pick<BusinessSettings, "depositPolicy">) {
  return settings.depositPolicy
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
