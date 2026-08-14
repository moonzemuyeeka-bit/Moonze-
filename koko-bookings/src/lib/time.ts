/**
 * Time helpers.
 *
 * The schedule is expressed in the *business* timezone (Africa/Lusaka by
 * default): a calendar date key (`YYYY-MM-DD`) plus a `HH:mm` time. Instants
 * (payment timestamps, reminders) are real `Date`s in UTC. These helpers are
 * the only place the two representations meet.
 */

export type DateKey = string; // YYYY-MM-DD
export type TimeString = string; // HH:mm

export const DEFAULT_TIMEZONE = "Africa/Lusaka";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isDateKey(value: string): boolean {
  return DATE_KEY_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function isTimeString(value: string): boolean {
  return TIME_PATTERN.test(value);
}

export function timeToMinutes(time: TimeString): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): TimeString {
  const normalised = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalised / 60);
  return `${String(hours).padStart(2, "0")}:${String(normalised % 60).padStart(2, "0")}`;
}

/** Offset of `timeZone` from UTC, in minutes, at the given instant. */
function timeZoneOffsetMinutes(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(instant);
  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  const asUtc = Date.UTC(
    lookup("year"),
    lookup("month") - 1,
    lookup("day"),
    lookup("hour"),
    lookup("minute"),
    lookup("second"),
  );
  return (asUtc - instant.getTime()) / 60_000;
}

/** Converts a business-local date + time into the matching UTC instant. */
export function zonedToInstant(
  date: DateKey,
  time: TimeString = "00:00",
  timeZone: string = DEFAULT_TIMEZONE,
): Date {
  const naive = Date.parse(`${date}T${time}:00Z`);
  const firstGuess = timeZoneOffsetMinutes(new Date(naive), timeZone);
  const adjusted = new Date(naive - firstGuess * 60_000);
  const offset = timeZoneOffsetMinutes(adjusted, timeZone);
  return new Date(naive - offset * 60_000);
}

/** The business-local date key for an instant. */
export function instantToDateKey(
  instant: Date,
  timeZone: string = DEFAULT_TIMEZONE,
): DateKey {
  const offset = timeZoneOffsetMinutes(instant, timeZone);
  const shifted = new Date(instant.getTime() + offset * 60_000);
  return shifted.toISOString().slice(0, 10);
}

/** The business-local `HH:mm` for an instant. */
export function instantToTime(
  instant: Date,
  timeZone: string = DEFAULT_TIMEZONE,
): TimeString {
  const offset = timeZoneOffsetMinutes(instant, timeZone);
  const shifted = new Date(instant.getTime() + offset * 60_000);
  return shifted.toISOString().slice(11, 16);
}

/** "Now" as the business sees it. */
export function businessNow(
  timeZone: string = DEFAULT_TIMEZONE,
  now: Date = new Date(),
): { date: DateKey; time: TimeString; minutes: number; instant: Date } {
  const date = instantToDateKey(now, timeZone);
  const time = instantToTime(now, timeZone);
  return { date, time, minutes: timeToMinutes(time), instant: now };
}

/**
 * Postgres `DATE` columns are read/written at UTC midnight so that the stored
 * calendar day never shifts with the server's timezone.
 */
export function dateKeyToDbDate(date: DateKey): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function dbDateToDateKey(value: Date): DateKey {
  return value.toISOString().slice(0, 10);
}

export function addDaysToDateKey(date: DateKey, days: number): DateKey {
  const base = new Date(`${date}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, matching `WorkingHours.dayOfWeek`. */
export function dayOfWeekForDateKey(date: DateKey): number {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

export function daysBetweenDateKeys(from: DateKey, to: DateKey): number {
  const a = Date.parse(`${from}T00:00:00.000Z`);
  const b = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((b - a) / 86_400_000);
}

/** "15 August 2026" */
export function formatDateLong(date: DateKey): string {
  return new Date(`${date}T12:00:00.000Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "Sat 15 Aug" */
export function formatDateShort(date: DateKey): string {
  return new Date(`${date}T12:00:00.000Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** "Saturday" */
export function formatWeekday(date: DateKey): string {
  return new Date(`${date}T12:00:00.000Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    timeZone: "UTC",
  });
}

/** "August 2026" */
export function formatMonthLabel(month: string): string {
  return new Date(`${month}-01T12:00:00.000Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "2 hours", "45 minutes", "1 hour 30 minutes" */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (rest > 0) parts.push(`${rest} minute${rest === 1 ? "" : "s"}`);
  return parts.join(" ") || "0 minutes";
}

/** `YYYY-MM` for a date key. */
export function monthKeyForDateKey(date: DateKey): string {
  return date.slice(0, 7);
}

export function firstDateKeyOfMonth(month: string): DateKey {
  return `${month}-01`;
}

export function daysInMonth(month: string): number {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

export function addMonths(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const base = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Minutes remaining until an instant, floored at zero. */
export function minutesUntil(instant: Date, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((instant.getTime() - now.getTime()) / 60_000));
}
