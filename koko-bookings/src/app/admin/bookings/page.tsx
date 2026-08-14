import { BookingTable, type AdminBookingView } from "@/components/admin/booking-table";
import { requireAdminPage } from "@/lib/auth/guard";
import { BOOKING_STATUS_LABEL, expireReservations } from "@/lib/booking/booking-service";
import {
  BOOKING_FILTERS,
  listBookings,
  type BookingFilter,
} from "@/lib/database/bookings";
import { dbDateToDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";

const VALID_FILTERS = new Set(BOOKING_FILTERS.map((filter) => filter.id));

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  await requireAdminPage("/admin/bookings");
  await expireReservations();

  const params = await searchParams;
  const filter = (VALID_FILTERS.has(params.filter as BookingFilter)
    ? params.filter
    : "today") as BookingFilter;
  const search = params.q ?? "";

  const bookings = await listBookings(filter, search);

  const rows: AdminBookingView[] = bookings.map((booking) => {
    const payment = booking.payments[0] ?? null;
    return {
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
      customerEmail: booking.customer.email,
      notes: booking.notes,
      depositNgwee: booking.depositNgwee,
      remainingNgwee: booking.remainingNgwee,
      totalNgwee: booking.totalNgwee,
      paymentStatus: payment?.status ?? null,
      paymentMethod: payment?.method ?? null,
    };
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl text-ink">Bookings</h1>
        <p className="text-sm text-ink-soft">
          {rows.length} booking{rows.length === 1 ? "" : "s"} in this view.
        </p>
      </div>

      <BookingTable
        bookings={rows}
        filters={BOOKING_FILTERS}
        activeFilter={filter}
        search={search}
      />
    </div>
  );
}
