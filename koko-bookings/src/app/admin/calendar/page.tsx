import {
  AdminCalendar,
  type AdminCalendarDay,
} from "@/components/admin/admin-calendar";
import { requireAdminPage } from "@/lib/auth/guard";
import { loadScheduleContext, scheduleForDate } from "@/lib/booking/availability";
import { BOOKING_STATUS_LABEL, expireReservations } from "@/lib/booking/booking-service";
import { getMonthOverview } from "@/lib/database/bookings";
import { prisma } from "@/lib/database/client";
import { getBusinessConfig } from "@/lib/database/settings";
import {
  businessNow,
  daysInMonth,
  dayOfWeekForDateKey,
  dbDateToDateKey,
  isDateKey,
  monthKeyForDateKey,
} from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; date?: string }>;
}) {
  await requireAdminPage("/admin/calendar");
  await expireReservations();

  const params = await searchParams;
  const config = await getBusinessConfig();
  const today = businessNow(config.timezone).date;

  const month =
    params.month && /^\d{4}-\d{2}$/.test(params.month)
      ? params.month
      : monthKeyForDateKey(today);
  const selectedDate =
    params.date && isDateKey(params.date) && monthKeyForDateKey(params.date) === month
      ? params.date
      : monthKeyForDateKey(today) === month
        ? today
        : `${month}-01`;

  const { bookings, overrides, slots } = await getMonthOverview(month);
  const overrideByDate = new Map(
    overrides.map((row) => [dbDateToDateKey(row.date), row]),
  );

  // Openness is measured against the shortest service, so "open" means at least
  // something can still be booked.
  const shortestService = await prisma.service.findFirst({
    where: { active: true },
    orderBy: { durationMinutes: "asc" },
  });

  const context = await loadScheduleContext(
    prisma,
    `${month}-01`,
    `${month}-${String(daysInMonth(month)).padStart(2, "0")}`,
    { config },
  );

  const days: AdminCalendarDay[] = [];
  for (let dayNumber = 1; dayNumber <= daysInMonth(month); dayNumber += 1) {
    const date = `${month}-${String(dayNumber).padStart(2, "0")}`;
    const override = overrideByDate.get(date);
    const workingHours = config.workingHours.find(
      (entry) => entry.dayOfWeek === dayOfWeekForDateKey(date),
    );
    const schedule = shortestService
      ? scheduleForDate(context, date, shortestService)
      : null;

    days.push({
      date,
      weekdayClosed: workingHours?.closed ?? true,
      blocked: override?.status === "UNAVAILABLE",
      blockReason: override?.reason ?? null,
      bookings: bookings.filter(
        (booking) => dbDateToDateKey(booking.appointmentDate) === date,
      ).length,
      availableSlots: schedule?.availableSlots ?? 0,
      totalSlots: schedule?.totalSlots ?? 0,
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl text-ink">Calendar</h1>
        <p className="text-sm text-ink-soft">
          Open or close dates, hand-craft time slots, and see who is booked.
        </p>
      </div>

      <AdminCalendar
        month={month}
        days={days}
        selectedDate={selectedDate}
        bookings={bookings.map((booking) => ({
          id: booking.id,
          reference: booking.bookingReference,
          date: dbDateToDateKey(booking.appointmentDate),
          startTime: booking.startTime,
          endTime: booking.endTime,
          status: booking.status,
          statusLabel: BOOKING_STATUS_LABEL[booking.status],
          serviceName: booking.serviceName,
          customerName: booking.customer.name,
          customerPhone: booking.customer.phone,
          depositNgwee: booking.depositNgwee,
          remainingNgwee: booking.remainingNgwee,
        }))}
        slots={slots.map((slot) => ({
          id: slot.id,
          date: dbDateToDateKey(slot.date),
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: slot.status,
          note: slot.note,
        }))}
      />
    </div>
  );
}
