import { CreditCard, Receipt, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdminPage } from "@/lib/auth/guard";
import { listPayments } from "@/lib/database/bookings";
import { listRecentNotifications } from "@/lib/notifications/notification-service";
import { formatKwacha } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { dbDateToDateKey, formatDateShort } from "@/lib/time";
import type { PaymentStatus } from "@/types";

export const dynamic = "force-dynamic";

const TONE: Record<PaymentStatus, "success" | "warning" | "danger" | "muted"> = {
  PENDING: "warning",
  PROCESSING: "warning",
  SUCCESSFUL: "success",
  FAILED: "danger",
  CANCELLED: "muted",
  EXPIRED: "muted",
  REFUNDED: "muted",
};

export default async function AdminPaymentsPage() {
  await requireAdminPage("/admin/payments");
  const [payments, notifications] = await Promise.all([
    listPayments(),
    listRecentNotifications(12),
  ]);

  const collected = payments
    .filter((payment) => payment.status === "SUCCESSFUL")
    .reduce((sum, payment) => sum + payment.amountNgwee - payment.refundedNgwee, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl text-ink">Deposits &amp; payments</h1>
        <p className="text-sm text-ink-soft">
          {formatKwacha(collected)} collected across {payments.length} payment
          {payments.length === 1 ? "" : "s"}. No card numbers, CVV or PINs are ever stored.
        </p>
      </div>

      {payments.length === 0 ? (
        <EmptyState icon={<Receipt />} title="No payments yet." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <caption className="sr-only">Payments</caption>
              <thead className="border-b border-line text-left text-xs uppercase tracking-[0.1em] text-ink-muted">
                <tr>
                  <th scope="col" className="p-4">Booking</th>
                  <th scope="col" className="p-4">Customer</th>
                  <th scope="col" className="p-4">Method</th>
                  <th scope="col" className="p-4">Amount</th>
                  <th scope="col" className="p-4">Status</th>
                  <th scope="col" className="p-4">Provider reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="p-4">
                      <p className="font-mono text-xs text-ink-soft">
                        {payment.booking.bookingReference}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {payment.booking.serviceName} ·{" "}
                        {formatDateShort(dbDateToDateKey(payment.booking.appointmentDate))}{" "}
                        {payment.booking.startTime}
                      </p>
                    </td>
                    <td className="p-4">
                      <p className="text-ink">{payment.booking.customer.name}</p>
                      <p className="text-xs text-ink-muted">
                        {formatPhone(payment.booking.customer.phone)}
                      </p>
                    </td>
                    <td className="p-4">
                      <span className="flex items-center gap-1.5 text-ink-soft">
                        {payment.method === "MOBILE_MONEY" ? (
                          <Smartphone className="size-4 text-blush-500" aria-hidden />
                        ) : (
                          <CreditCard className="size-4 text-blush-500" aria-hidden />
                        )}
                        {payment.instrumentBrand ??
                          (payment.method === "MOBILE_MONEY" ? "Mobile Money" : "Card")}
                        {payment.instrumentLast4 ? ` ••${payment.instrumentLast4}` : ""}
                      </span>
                    </td>
                    <td className="p-4 text-ink">
                      {formatKwacha(payment.amountNgwee)}
                      {payment.refundedNgwee > 0 ? (
                        <span className="block text-xs text-ink-muted">
                          {formatKwacha(payment.refundedNgwee)} refunded
                        </span>
                      ) : null}
                    </td>
                    <td className="p-4">
                      <Badge tone={TONE[payment.status]}>{payment.status}</Badge>
                      {payment.failureReason ? (
                        <span className="mt-1 block text-xs text-ink-muted">
                          {payment.failureReason}
                        </span>
                      ) : null}
                    </td>
                    <td className="p-4 font-mono text-xs text-ink-muted">
                      {payment.providerReference}
                      <span className="mt-1 block font-sans">{payment.provider}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-3 p-4 pt-4 sm:p-5 sm:pt-5">
          <h2 className="font-display text-xl text-ink">Recent messages to customers</h2>
          <p className="text-xs text-ink-muted">
            WhatsApp, SMS and email adapters are wired but unconfigured, so messages are
            logged here instead of being silently dropped.
          </p>
          {notifications.length === 0 ? (
            <EmptyState title="No messages yet." />
          ) : (
            <ul className="divide-y divide-line">
              {notifications.map((notification) => (
                <li key={notification.id} className="space-y-1 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={notification.status === "SENT" ? "success" : "muted"}>
                      {notification.channel}
                    </Badge>
                    <span className="text-xs text-ink-muted">
                      {notification.event.replaceAll("_", " ").toLowerCase()} ·{" "}
                      {notification.booking?.bookingReference ?? "—"}
                    </span>
                  </div>
                  <p className="text-sm text-ink-soft">{notification.message}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
