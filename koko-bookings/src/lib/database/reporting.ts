import { prisma } from "@/lib/database/client";
import { getBusinessConfig } from "@/lib/database/settings";
import { scheduleForDate, loadScheduleContext } from "@/lib/booking/availability";
import {
  addDaysToDateKey,
  businessNow,
  dateKeyToDbDate,
  dbDateToDateKey,
  type DateKey,
} from "@/lib/time";

/**
 * Dashboard aggregates. Everything the owner needs on a phone between clients:
 * what is happening today, what is coming, and what has actually been collected.
 */

export type DashboardStats = {
  today: DateKey;
  todaysAppointments: number;
  upcomingAppointments: number;
  depositsCollectedTodayNgwee: number;
  depositsCollectedAllTimeNgwee: number;
  availableSlotsToday: number;
  cancelledThisMonth: number;
  noShowsThisMonth: number;
  pendingPayments: number;
  revenue: {
    todayNgwee: number;
    weekNgwee: number;
    monthNgwee: number;
    expectedMonthNgwee: number;
  };
  newCustomersThisMonth: number;
};

const EARNING_STATUSES = ["CONFIRMED", "COMPLETED", "NO_SHOW"] as const;

export async function getDashboardStats(now: Date = new Date()): Promise<DashboardStats> {
  const config = await getBusinessConfig();
  const today = businessNow(config.timezone, now).date;
  const monthStart = `${today.slice(0, 7)}-01`;
  const weekStart = addDaysToDateKey(today, -6);

  const [
    todaysBookings,
    upcomingCount,
    depositsToday,
    depositsAllTime,
    cancelledThisMonth,
    noShowsThisMonth,
    pendingPayments,
    completedToday,
    completedWeek,
    completedMonth,
    expectedMonth,
    newCustomers,
  ] = await Promise.all([
    prisma.booking.findMany({
      where: {
        appointmentDate: dateKeyToDbDate(today),
        status: { in: ["CONFIRMED", "COMPLETED"] },
      },
      select: { startTime: true },
    }),
    prisma.booking.count({
      where: { appointmentDate: { gt: dateKeyToDbDate(today) }, status: "CONFIRMED" },
    }),
    prisma.payment.aggregate({
      _sum: { amountNgwee: true },
      where: {
        status: "SUCCESSFUL",
        paidAt: {
          gte: new Date(`${today}T00:00:00.000Z`),
          lt: new Date(`${addDaysToDateKey(today, 1)}T00:00:00.000Z`),
        },
      },
    }),
    prisma.payment.aggregate({
      _sum: { amountNgwee: true },
      where: { status: "SUCCESSFUL" },
    }),
    prisma.booking.count({
      where: {
        status: "CANCELLED",
        appointmentDate: { gte: dateKeyToDbDate(monthStart) },
      },
    }),
    prisma.booking.count({
      where: {
        status: "NO_SHOW",
        appointmentDate: { gte: dateKeyToDbDate(monthStart) },
      },
    }),
    prisma.booking.count({
      where: { status: "PENDING_PAYMENT", reservationExpiresAt: { gt: now } },
    }),
    sumRevenue(today, today),
    sumRevenue(weekStart, today),
    sumRevenue(monthStart, today),
    prisma.booking.aggregate({
      _sum: { totalNgwee: true },
      where: {
        status: { in: [...EARNING_STATUSES] },
        appointmentDate: {
          gte: dateKeyToDbDate(monthStart),
          lte: dateKeyToDbDate(`${today.slice(0, 7)}-28`),
        },
      },
    }),
    prisma.customer.count({
      where: { createdAt: { gte: new Date(`${monthStart}T00:00:00.000Z`) } },
    }),
  ]);

  // How many start times are still open today, for the most-booked service.
  const busiestService = await prisma.service.findFirst({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
  let availableSlotsToday = 0;
  if (busiestService) {
    const context = await loadScheduleContext(prisma, today, today, { config, now });
    availableSlotsToday = scheduleForDate(context, today, busiestService).availableSlots;
  }

  return {
    today,
    todaysAppointments: todaysBookings.length,
    upcomingAppointments: upcomingCount,
    depositsCollectedTodayNgwee: depositsToday._sum.amountNgwee ?? 0,
    depositsCollectedAllTimeNgwee: depositsAllTime._sum.amountNgwee ?? 0,
    availableSlotsToday,
    cancelledThisMonth,
    noShowsThisMonth,
    pendingPayments,
    revenue: {
      todayNgwee: completedToday,
      weekNgwee: completedWeek,
      monthNgwee: completedMonth,
      expectedMonthNgwee: expectedMonth._sum.totalNgwee ?? 0,
    },
    newCustomersThisMonth: newCustomers,
  };
}

/** Service value delivered between two dates (completed and no-show deposits). */
async function sumRevenue(from: DateKey, to: DateKey): Promise<number> {
  const [completed, noShows] = await Promise.all([
    prisma.booking.aggregate({
      _sum: { totalNgwee: true },
      where: {
        status: "COMPLETED",
        appointmentDate: { gte: dateKeyToDbDate(from), lte: dateKeyToDbDate(to) },
      },
    }),
    prisma.booking.aggregate({
      _sum: { depositNgwee: true },
      where: {
        status: "NO_SHOW",
        appointmentDate: { gte: dateKeyToDbDate(from), lte: dateKeyToDbDate(to) },
      },
    }),
  ]);
  return (completed._sum.totalNgwee ?? 0) + (noShows._sum.depositNgwee ?? 0);
}

/** Last 14 days of collected value, for the dashboard chart. */
export async function getRevenueTrend(
  days = 14,
  now: Date = new Date(),
): Promise<{ date: DateKey; ngwee: number }[]> {
  const config = await getBusinessConfig();
  const today = businessNow(config.timezone, now).date;
  const from = addDaysToDateKey(today, -(days - 1));

  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ["COMPLETED", "NO_SHOW", "CONFIRMED"] },
      appointmentDate: { gte: dateKeyToDbDate(from), lte: dateKeyToDbDate(today) },
    },
    select: {
      appointmentDate: true,
      status: true,
      totalNgwee: true,
      depositNgwee: true,
    },
  });

  const totals = new Map<DateKey, number>();
  for (let offset = 0; offset < days; offset += 1) {
    totals.set(addDaysToDateKey(from, offset), 0);
  }
  for (const booking of bookings) {
    const key = dbDateToDateKey(booking.appointmentDate);
    const value =
      booking.status === "COMPLETED"
        ? booking.totalNgwee
        : booking.status === "NO_SHOW"
          ? booking.depositNgwee
          : booking.depositNgwee;
    totals.set(key, (totals.get(key) ?? 0) + value);
  }

  return [...totals.entries()].map(([date, ngwee]) => ({ date, ngwee }));
}

export async function getTodaysSchedule(now: Date = new Date()) {
  const config = await getBusinessConfig();
  const today = businessNow(config.timezone, now).date;

  return prisma.booking.findMany({
    where: {
      appointmentDate: dateKeyToDbDate(today),
      status: { in: ["CONFIRMED", "COMPLETED", "NO_SHOW"] },
    },
    orderBy: { startTime: "asc" },
    include: { customer: { select: { name: true, phone: true } } },
  });
}

export async function getNextAppointment(now: Date = new Date()) {
  const config = await getBusinessConfig();
  const local = businessNow(config.timezone, now);

  const todays = await prisma.booking.findMany({
    where: { appointmentDate: dateKeyToDbDate(local.date), status: "CONFIRMED" },
    orderBy: { startTime: "asc" },
    include: { customer: { select: { name: true, phone: true } } },
  });
  const laterToday = todays.find((booking) => booking.startTime >= local.time);
  if (laterToday) return laterToday;

  return prisma.booking.findFirst({
    where: {
      appointmentDate: { gt: dateKeyToDbDate(local.date) },
      status: "CONFIRMED",
    },
    orderBy: [{ appointmentDate: "asc" }, { startTime: "asc" }],
    include: { customer: { select: { name: true, phone: true } } },
  });
}

export type ServicePerformance = {
  serviceName: string;
  bookings: number;
  valueNgwee: number;
};

export async function getServicePerformance(
  now: Date = new Date(),
): Promise<ServicePerformance[]> {
  const config = await getBusinessConfig();
  const today = businessNow(config.timezone, now).date;
  const monthStart = `${today.slice(0, 7)}-01`;

  const grouped = await prisma.booking.groupBy({
    by: ["serviceName"],
    where: {
      status: { in: [...EARNING_STATUSES] },
      appointmentDate: { gte: dateKeyToDbDate(monthStart) },
    },
    _count: { _all: true },
    _sum: { totalNgwee: true },
  });

  return grouped
    .map((row) => ({
      serviceName: row.serviceName,
      bookings: row._count._all,
      valueNgwee: row._sum.totalNgwee ?? 0,
    }))
    .sort((a, b) => b.valueNgwee - a.valueNgwee);
}
