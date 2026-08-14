import type { BookingStatus, Prisma, Service } from "@/generated/prisma";
import { buildDaySchedule, DAY_STATUS_LABEL, type BusyInterval } from "@/lib/booking/slots";
import { prisma } from "@/lib/database/client";
import { getBusinessConfig, type BusinessConfig } from "@/lib/database/settings";
import {
  addDaysToDateKey,
  businessNow,
  dateKeyToDbDate,
  daysInMonth,
  dayOfWeekForDateKey,
  dbDateToDateKey,
  timeToMinutes,
  type DateKey,
} from "@/lib/time";
import type { CalendarDayDto, DaySlotsDto } from "@/types";

/** Statuses that occupy a slot: reservations, confirmed and completed work. */
export const LIVE_BOOKING_STATUSES: BookingStatus[] = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "COMPLETED",
];

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Bookings that currently hold a slot. Reservations whose payment window has
 * lapsed are ignored, which is what makes an abandoned checkout free up the
 * time again.
 */
export async function loadOccupancy(
  db: Db,
  fromDate: DateKey,
  toDate: DateKey,
  now: Date = new Date(),
): Promise<Map<DateKey, BusyInterval[]>> {
  const bookings = await db.booking.findMany({
    where: {
      appointmentDate: { gte: dateKeyToDbDate(fromDate), lte: dateKeyToDbDate(toDate) },
      status: { in: LIVE_BOOKING_STATUSES },
      OR: [
        { status: { in: ["CONFIRMED", "COMPLETED"] } },
        { status: "PENDING_PAYMENT", reservationExpiresAt: { gt: now } },
      ],
    },
    select: {
      id: true,
      appointmentDate: true,
      startTime: true,
      endTime: true,
    },
  });

  const map = new Map<DateKey, BusyInterval[]>();
  for (const booking of bookings) {
    const key = dbDateToDateKey(booking.appointmentDate);
    const list = map.get(key) ?? [];
    list.push({
      bookingId: booking.id,
      startMinutes: timeToMinutes(booking.startTime),
      endMinutes: timeToMinutes(booking.endTime),
    });
    map.set(key, list);
  }
  return map;
}

export async function loadDayOverrides(db: Db, fromDate: DateKey, toDate: DateKey) {
  const rows = await db.availability.findMany({
    where: { date: { gte: dateKeyToDbDate(fromDate), lte: dateKeyToDbDate(toDate) } },
  });
  return new Map(rows.map((row) => [dbDateToDateKey(row.date), row]));
}

export async function loadExplicitSlots(db: Db, fromDate: DateKey, toDate: DateKey) {
  const rows = await db.timeSlot.findMany({
    where: { date: { gte: dateKeyToDbDate(fromDate), lte: dateKeyToDbDate(toDate) } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
  const map = new Map<DateKey, typeof rows>();
  for (const row of rows) {
    const key = dbDateToDateKey(row.date);
    map.set(key, [...(map.get(key) ?? []), row]);
  }
  return map;
}

type ScheduleContext = {
  config: BusinessConfig;
  occupancy: Map<DateKey, BusiestIntervals>;
  overrides: Awaited<ReturnType<typeof loadDayOverrides>>;
  explicitSlots: Awaited<ReturnType<typeof loadExplicitSlots>>;
  now: { date: DateKey; minutes: number };
};
type BusiestIntervals = BusyInterval[];

export async function loadScheduleContext(
  db: Db,
  fromDate: DateKey,
  toDate: DateKey,
  options: { config?: BusinessConfig; now?: Date } = {},
): Promise<ScheduleContext> {
  const config = options.config ?? (await getBusinessConfig());
  const now = options.now ?? new Date();
  const [occupancy, overrides, explicitSlots] = await Promise.all([
    loadOccupancy(db, fromDate, toDate, now),
    loadDayOverrides(db, fromDate, toDate),
    loadExplicitSlots(db, fromDate, toDate),
  ]);

  const local = businessNow(config.timezone, now);
  return {
    config,
    occupancy,
    overrides,
    explicitSlots,
    now: { date: local.date, minutes: local.minutes },
  };
}

export function scheduleForDate(
  context: ScheduleContext,
  date: DateKey,
  service: Pick<Service, "durationMinutes">,
  options: { ignoreBookingId?: string } = {},
) {
  const { config } = context;
  const workingHours =
    config.workingHours.find((day) => day.dayOfWeek === dayOfWeekForDateKey(date)) ?? null;
  const busy = context.occupancy.get(date) ?? [];

  return buildDaySchedule({
    date,
    now: context.now,
    workingHours,
    explicitSlots: context.explicitSlots.get(date)?.map((slot) => ({
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: slot.status,
    })),
    dayOverride: context.overrides.get(date) ?? null,
    serviceDurationMinutes: service.durationMinutes,
    slotIntervalMinutes: config.slotIntervalMinutes,
    bufferMinutes: config.bufferMinutes,
    busy,
    bookingsOnDate: busy.filter(
      (interval) => interval.bookingId !== options.ignoreBookingId,
    ).length,
    maxDailyBookings: config.maxDailyBookings,
    bookingWindowDays: config.bookingWindowDays,
    minNoticeHours: config.minNoticeHours,
    ignoreBookingId: options.ignoreBookingId,
  });
}

/** Calendar month view: one status per day, for the booking calendar. */
export async function getMonthAvailability(
  month: string,
  service: Pick<Service, "durationMinutes">,
  options: { now?: Date } = {},
): Promise<CalendarDayDto[]> {
  const first = `${month}-01`;
  const last = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  const context = await loadScheduleContext(prisma, first, last, { now: options.now });

  const days: CalendarDayDto[] = [];
  for (let dayNumber = 1; dayNumber <= daysInMonth(month); dayNumber += 1) {
    const date = `${month}-${String(dayNumber).padStart(2, "0")}`;
    const schedule = scheduleForDate(context, date, service);
    days.push({
      date,
      status: schedule.dayStatus,
      label: DAY_STATUS_LABEL[schedule.dayStatus],
      totalSlots: schedule.totalSlots,
      availableSlots: schedule.availableSlots,
      reason: context.overrides.get(date)?.reason ?? schedule.reason,
    });
  }
  return days;
}

/** Time grid for a single date and service. */
export async function getDaySlots(
  date: DateKey,
  service: Pick<Service, "id" | "durationMinutes">,
  options: { now?: Date } = {},
): Promise<DaySlotsDto> {
  const context = await loadScheduleContext(prisma, date, date, { now: options.now });
  const schedule = scheduleForDate(context, date, service);
  return {
    date,
    serviceId: service.id,
    slots: schedule.slots,
    dayStatus: schedule.dayStatus,
    reason: context.overrides.get(date)?.reason ?? schedule.reason,
  };
}

/** Next few bookable dates — used for "choose another date" suggestions. */
export async function findNextAvailableDates(
  service: Pick<Service, "durationMinutes">,
  options: { from?: DateKey; limit?: number; now?: Date } = {},
): Promise<DateKey[]> {
  const config = await getBusinessConfig();
  const now = options.now ?? new Date();
  const start = options.from ?? businessNow(config.timezone, now).date;
  const horizon = Math.min(config.bookingWindowDays, 45);
  const end = addDaysToDateKey(start, horizon);
  const context = await loadScheduleContext(prisma, start, end, { config, now });

  const found: DateKey[] = [];
  for (let offset = 0; offset <= horizon && found.length < (options.limit ?? 3); offset += 1) {
    const date = addDaysToDateKey(start, offset);
    if (scheduleForDate(context, date, service).availableSlots > 0) found.push(date);
  }
  return found;
}
