import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Mail, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdminPage } from "@/lib/auth/guard";
import { BOOKING_STATUS_LABEL } from "@/lib/booking/booking-service";
import { getCustomerWithHistory } from "@/lib/database/customers";
import { formatKwacha } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { dbDateToDateKey, formatDateLong } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function AdminCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage("/admin/customers");
  const { id } = await params;
  const customer = await getCustomerWithHistory(id);
  if (!customer) notFound();

  const history = customer.bookings.filter(
    (booking) => booking.status !== "EXPIRED",
  );
  const completed = history.filter((booking) => booking.status === "COMPLETED");
  const totalSpent = completed.reduce((sum, booking) => sum + booking.totalNgwee, 0);
  const depositsPaid = customer.bookings
    .flatMap((booking) => booking.payments)
    .filter((payment) => payment.status === "SUCCESSFUL")
    .reduce((sum, payment) => sum + payment.amountNgwee, 0);

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/customers">
          <ArrowLeft aria-hidden /> All customers
        </Link>
      </Button>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">{customer.name}</h1>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
            <span className="flex items-center gap-1.5">
              <Phone className="size-4 text-blush-500" aria-hidden />
              {formatPhone(customer.phone)}
            </span>
            {customer.email ? (
              <span className="flex items-center gap-1.5">
                <Mail className="size-4 text-blush-500" aria-hidden />
                {customer.email}
              </span>
            ) : null}
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4 text-blush-500" aria-hidden />
              Customer since {formatDateLong(customer.createdAt.toISOString().slice(0, 10))}
            </span>
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 pt-4">
            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Appointments</p>
            <p className="font-display text-2xl text-ink">{history.length}</p>
            <p className="text-xs text-ink-soft">{completed.length} completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 pt-4">
            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Total spent</p>
            <p className="font-display text-2xl text-ink">{formatKwacha(totalSpent)}</p>
            <p className="text-xs text-ink-soft">Completed services</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 pt-4">
            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Deposits paid</p>
            <p className="font-display text-2xl text-ink">{formatKwacha(depositsPaid)}</p>
            <p className="text-xs text-ink-soft">Across all bookings</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4 pt-4 sm:p-5 sm:pt-5">
          <h2 className="font-display text-xl text-ink">Booking history</h2>
          {history.length === 0 ? (
            <EmptyState title="No appointments yet." />
          ) : (
            <ul className="divide-y divide-line">
              {history.map((booking) => (
                <li key={booking.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">
                      {formatDateLong(dbDateToDateKey(booking.appointmentDate))} ·{" "}
                      {booking.startTime}
                    </p>
                    <p className="truncate text-xs text-ink-soft">
                      {booking.serviceName} · {booking.bookingReference} · deposit{" "}
                      {formatKwacha(booking.depositNgwee)} · balance{" "}
                      {formatKwacha(booking.remainingNgwee)}
                    </p>
                    {booking.notes ? (
                      <p className="truncate text-xs text-ink-muted">Notes: {booking.notes}</p>
                    ) : null}
                  </div>
                  <Badge
                    tone={
                      booking.status === "CONFIRMED"
                        ? "success"
                        : booking.status === "COMPLETED"
                          ? "brand"
                          : booking.status === "PENDING_PAYMENT"
                            ? "warning"
                            : "danger"
                    }
                  >
                    {BOOKING_STATUS_LABEL[booking.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
