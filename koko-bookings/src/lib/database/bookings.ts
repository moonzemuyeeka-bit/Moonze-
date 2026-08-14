import type { BookingStatus, Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/database/client";
import { getSettings } from "@/lib/database/settings";
import { normalisePhone } from "@/lib/phone";
import { businessNow, dateKeyToDbDate } from "@/lib/time";

export type BookingFilter =
  | "all"
  | "today"
  | "upcoming"
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no-show";

export const BOOKING_FILTERS: { id: BookingFilter; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "confirmed", label: "Confirmed" },
  { id: "pending", label: "Pending" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "no-show", label: "No-show" },
  { id: "all", label: "All" },
];

const STATUS_BY_FILTER: Partial<Record<BookingFilter, BookingStatus[]>> = {
  pending: ["PENDING_PAYMENT"],
  confirmed: ["CONFIRMED"],
  completed: ["COMPLETED"],
  cancelled: ["CANCELLED"],
  "no-show": ["NO_SHOW"],
};

/** Admin booking list: filtered by state or date window, searchable. */
export async function listBookings(
  filter: BookingFilter = "today",
  search?: string,
  now: Date = new Date(),
) {
  const settings = await getSettings();
  const today = businessNow(settings.timezone, now).date;
  const term = search?.trim();

  const where: Prisma.BookingWhereInput = {};

  if (filter === "today") {
    where.appointmentDate = dateKeyToDbDate(today);
  } else if (filter === "upcoming") {
    where.appointmentDate = { gte: dateKeyToDbDate(today) };
    where.status = { in: ["PENDING_PAYMENT", "CONFIRMED"] };
  } else if (STATUS_BY_FILTER[filter]) {
    where.status = { in: STATUS_BY_FILTER[filter] };
  }

  if (term) {
    const phone = normalisePhone(term);
    where.OR = [
      { bookingReference: { contains: term.toUpperCase() } },
      { customer: { name: { contains: term, mode: "insensitive" } } },
      ...(phone ? [{ customer: { phone } }] : []),
      { customer: { phone: { contains: term.replace(/[^\d]/g, "") } } },
    ];
    // A search should look everywhere, not just inside the current filter.
    delete where.appointmentDate;
    if (!STATUS_BY_FILTER[filter]) delete where.status;
  }

  return prisma.booking.findMany({
    where,
    orderBy: [{ appointmentDate: filter === "completed" || filter === "cancelled" ? "desc" : "asc" }, { startTime: "asc" }],
    take: 200,
    include: {
      customer: { select: { id: true, name: true, phone: true, email: true } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
}

export type AdminBookingRow = Awaited<ReturnType<typeof listBookings>>[number];

export async function listPayments(limit = 100) {
  return prisma.payment.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      booking: {
        select: {
          bookingReference: true,
          serviceName: true,
          appointmentDate: true,
          startTime: true,
          status: true,
          customer: { select: { name: true, phone: true } },
        },
      },
    },
  });
}

/** Bookings and slot overrides for a month, for the admin calendar. */
export async function getMonthOverview(month: string) {
  const first = dateKeyToDbDate(`${month}-01`);
  const [year, monthNumber] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, monthNumber, 0));

  const [bookings, overrides, slots] = await Promise.all([
    prisma.booking.findMany({
      where: {
        appointmentDate: { gte: first, lte: last },
        status: { in: ["PENDING_PAYMENT", "CONFIRMED", "COMPLETED", "NO_SHOW"] },
      },
      orderBy: [{ appointmentDate: "asc" }, { startTime: "asc" }],
      include: { customer: { select: { name: true, phone: true } } },
    }),
    prisma.availability.findMany({ where: { date: { gte: first, lte: last } } }),
    prisma.timeSlot.findMany({
      where: { date: { gte: first, lte: last } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
  ]);

  return { bookings, overrides, slots };
}
