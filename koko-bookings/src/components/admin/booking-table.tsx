"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ListChecks, Search, UserX, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/field";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { formatKwacha } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { formatDateShort } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { BookingStatus, PaymentStatus } from "@/types";

export type AdminBookingView = {
  id: string;
  reference: string;
  date: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  statusLabel: string;
  serviceName: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  notes: string | null;
  depositNgwee: number;
  remainingNgwee: number;
  totalNgwee: number;
  paymentStatus: PaymentStatus | null;
  paymentMethod: string | null;
};

const STATUS_TONE: Record<BookingStatus, "success" | "warning" | "danger" | "brand" | "muted"> = {
  PENDING_PAYMENT: "warning",
  CONFIRMED: "success",
  COMPLETED: "brand",
  CANCELLED: "danger",
  NO_SHOW: "danger",
  EXPIRED: "muted",
};

const PAYMENT_TONE: Record<PaymentStatus, "success" | "warning" | "danger" | "muted"> = {
  PENDING: "warning",
  PROCESSING: "warning",
  SUCCESSFUL: "success",
  FAILED: "danger",
  CANCELLED: "muted",
  EXPIRED: "muted",
  REFUNDED: "muted",
};

const NEXT_STATUSES: { value: BookingStatus; label: string }[] = [
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "COMPLETED", label: "Completed" },
  { value: "NO_SHOW", label: "No-show" },
  { value: "CANCELLED", label: "Cancelled" },
];

/**
 * Booking management: filter, search and move a booking through its lifecycle.
 * Cards on a phone, a table on a desktop — same data, same actions.
 */
export function BookingTable({
  bookings,
  filters,
  activeFilter,
  search,
}: {
  bookings: AdminBookingView[];
  filters: { id: string; label: string }[];
  activeFilter: string;
  search: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [term, setTerm] = useState(search);
  const [busyReference, setBusyReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  function applyParams(next: Record<string, string | null>) {
    const search = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") search.delete(key);
      else search.set(key, value);
    }
    router.push(`/admin/bookings?${search.toString()}`);
  }

  async function changeStatus(reference: string, status: BookingStatus) {
    setBusyReference(reference);
    setError(null);
    setNote(null);
    try {
      await apiRequest("/api/admin/bookings", {
        method: "PATCH",
        json: { reference, status },
      });
      setNote(`${reference} is now ${status.replace("_", " ").toLowerCase()}.`);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusyReference(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4 pt-4">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              applyParams({ q: term });
            }}
          >
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
                aria-hidden
              />
              <Input
                aria-label="Search bookings"
                className="pl-11"
                placeholder="Search reference, name or phone"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary">
              Search
            </Button>
            {search ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setTerm("");
                  applyParams({ q: null });
                }}
              >
                <X aria-hidden /> Clear
              </Button>
            ) : null}
          </form>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {filters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => applyParams({ filter: filter.id })}
                aria-pressed={activeFilter === filter.id}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                  activeFilter === filter.id
                    ? "border-blush-500 bg-blush-100 text-blush-800"
                    : "border-line bg-white text-ink-soft hover:border-blush-300",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert tone="danger" title="That did not work">
          <p>{error}</p>
        </Alert>
      ) : null}
      {note ? (
        <Alert tone="success" title="Updated">
          <p>{note}</p>
        </Alert>
      ) : null}

      {bookings.length === 0 ? (
        <EmptyState
          icon={<ListChecks />}
          title="No bookings match this view."
          description="Try another filter, or clear your search."
        />
      ) : (
        <>
          {/* Mobile cards */}
          <ul className="space-y-3 lg:hidden">
            {bookings.map((booking) => (
              <li key={booking.id}>
                <Card>
                  <CardContent className="space-y-3 p-4 pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display text-lg text-ink">
                          {formatDateShort(booking.date)} · {booking.startTime}
                        </p>
                        <p className="truncate text-sm text-ink">{booking.customerName}</p>
                        <p className="truncate text-xs text-ink-soft">
                          {booking.serviceName} · {formatPhone(booking.customerPhone)}
                        </p>
                        <p className="mt-1 font-mono text-xs text-ink-muted">
                          {booking.reference}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <Badge tone={STATUS_TONE[booking.status]}>{booking.statusLabel}</Badge>
                        {booking.paymentStatus ? (
                          <Badge tone={PAYMENT_TONE[booking.paymentStatus]}>
                            {booking.paymentStatus}
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    <p className="text-sm text-ink-soft">
                      Deposit {formatKwacha(booking.depositNgwee)} · Balance{" "}
                      {formatKwacha(booking.remainingNgwee)}
                    </p>

                    <StatusActions
                      booking={booking}
                      busy={busyReference === booking.reference}
                      onChange={changeStatus}
                    />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <Card className="hidden lg:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[64rem] text-sm">
                <caption className="sr-only">Bookings</caption>
                <thead className="border-b border-line text-left text-xs uppercase tracking-[0.1em] text-ink-muted">
                  <tr>
                    <th scope="col" className="p-4">Reference</th>
                    <th scope="col" className="p-4">Customer</th>
                    <th scope="col" className="p-4">Service</th>
                    <th scope="col" className="p-4">When</th>
                    <th scope="col" className="p-4">Deposit</th>
                    <th scope="col" className="p-4">Balance</th>
                    <th scope="col" className="p-4">Payment</th>
                    <th scope="col" className="p-4">Status</th>
                    <th scope="col" className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="align-top">
                      <td className="p-4 font-mono text-xs text-ink-soft">
                        {booking.reference}
                      </td>
                      <td className="p-4">
                        <p className="font-medium text-ink">{booking.customerName}</p>
                        <p className="text-xs text-ink-muted">
                          {formatPhone(booking.customerPhone)}
                        </p>
                      </td>
                      <td className="p-4 text-ink-soft">{booking.serviceName}</td>
                      <td className="p-4 text-ink-soft">
                        {formatDateShort(booking.date)}
                        <br />
                        <span className="text-xs">
                          {booking.startTime}–{booking.endTime}
                        </span>
                      </td>
                      <td className="p-4 text-ink-soft">{formatKwacha(booking.depositNgwee)}</td>
                      <td className="p-4 text-ink-soft">
                        {formatKwacha(booking.remainingNgwee)}
                      </td>
                      <td className="p-4">
                        {booking.paymentStatus ? (
                          <Badge tone={PAYMENT_TONE[booking.paymentStatus]}>
                            {booking.paymentStatus}
                          </Badge>
                        ) : (
                          <span className="text-xs text-ink-muted">None</span>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge tone={STATUS_TONE[booking.status]}>{booking.statusLabel}</Badge>
                      </td>
                      <td className="p-4">
                        <StatusActions
                          booking={booking}
                          busy={busyReference === booking.reference}
                          onChange={changeStatus}
                          compact
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function StatusActions({
  booking,
  busy,
  compact = false,
  onChange,
}: {
  booking: AdminBookingView;
  busy: boolean;
  compact?: boolean;
  onChange: (reference: string, status: BookingStatus) => void;
}) {
  const finished = ["COMPLETED", "CANCELLED", "NO_SHOW", "EXPIRED"].includes(booking.status);

  if (finished) {
    return <p className="text-xs text-ink-muted">No further action needed.</p>;
  }

  if (compact) {
    return (
      <Select
        aria-label={`Change status for ${booking.reference}`}
        className="h-10 w-40 text-sm"
        value=""
        disabled={busy}
        onChange={(event) => {
          if (event.target.value) onChange(booking.reference, event.target.value as BookingStatus);
        }}
      >
        <option value="">Change status…</option>
        {NEXT_STATUSES.filter((option) => option.value !== booking.status).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {booking.status === "CONFIRMED" ? (
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => onChange(booking.reference, "COMPLETED")}
        >
          <CheckCircle2 aria-hidden /> Completed
        </Button>
      ) : null}
      {booking.status === "CONFIRMED" ? (
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => onChange(booking.reference, "NO_SHOW")}
        >
          <UserX aria-hidden /> No-show
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="ghost"
        disabled={busy}
        onClick={() => onChange(booking.reference, "CANCELLED")}
      >
        <X aria-hidden /> Cancel
      </Button>
    </div>
  );
}
