"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CalendarPlus,
  Clock,
  Search,
  Sparkles,
  TicketCheck,
  XCircle,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { buildBookingIcs, icsDataUrl } from "@/lib/calendar";
import { formatKwacha } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import type { BookingDto } from "@/types";

const STATUS_TONE: Record<
  BookingDto["status"],
  "brand" | "success" | "warning" | "danger" | "muted"
> = {
  PENDING_PAYMENT: "warning",
  CONFIRMED: "success",
  COMPLETED: "brand",
  CANCELLED: "danger",
  NO_SHOW: "danger",
  EXPIRED: "muted",
};

/**
 * Customer self-service: look a booking up with the reference and the phone
 * number used to book it (no account, but not guessable either).
 */
export function BookingLookup({
  businessName,
  timezone,
  cancellationPolicy,
  defaultReference,
}: {
  businessName: string;
  timezone: string;
  cancellationPolicy: string;
  defaultReference?: string;
}) {
  const [reference, setReference] = useState(defaultReference ?? "");
  const [phone, setPhone] = useState("");
  const [booking, setBooking] = useState<BookingDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [note, setNote] = useState<string | null>(null);

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setNote(null);
    setFieldErrors({});
    try {
      const data = await apiRequest<{ booking: BookingDto }>("/api/bookings/lookup", {
        method: "POST",
        json: { reference, phone },
      });
      setBooking(data.booking);
    } catch (caught) {
      setBooking(null);
      if (caught instanceof ApiClientError) {
        setError(caught.message);
        setFieldErrors(caught.fields ?? {});
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function cancelBooking() {
    if (!booking) return;
    setCancelling(true);
    setError(null);
    try {
      const data = await apiRequest<{ booking: BookingDto }>("/api/bookings/cancel", {
        method: "POST",
        json: { reference: booking.reference, phone },
      });
      setBooking(data.booking);
      setNote("Your appointment has been cancelled. We hope to see you another time.");
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setCancelling(false);
    }
  }

  const canCancel =
    booking && ["PENDING_PAYMENT", "CONFIRMED"].includes(booking.status);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-5 pt-5 sm:p-6 sm:pt-6">
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={lookup} noValidate>
            <Field
              label="Booking reference"
              htmlFor="lookup-reference"
              required
              hint="Looks like KOKO-8F42A1"
              error={fieldErrors.reference}
            >
              <Input
                id="lookup-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value.toUpperCase())}
                placeholder="KOKO-8F42A1"
                autoComplete="off"
                spellCheck={false}
              />
            </Field>

            <Field
              label="Mobile number"
              htmlFor="lookup-phone"
              required
              hint="The number you booked with"
              error={fieldErrors.phone}
            >
              <Input
                id="lookup-phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+260 97X XXX XXX"
              />
            </Field>

            <div className="sm:col-span-2">
              <Button
                type="submit"
                size="lg"
                full
                loading={loading}
                loadingText="Finding your booking…"
              >
                <Search aria-hidden />
                Find my booking
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error ? (
        <Alert tone="danger" title="We could not find that booking">
          <p>{error}</p>
        </Alert>
      ) : null}

      {note ? (
        <Alert tone="success" title="Updated">
          <p>{note}</p>
        </Alert>
      ) : null}

      {booking ? (
        <Card>
          <CardContent className="space-y-5 p-5 pt-5 sm:p-6 sm:pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-ink-muted">
                  Booking reference
                </p>
                <p className="font-display text-2xl text-blush-900">{booking.reference}</p>
              </div>
              <Badge tone={STATUS_TONE[booking.status]}>
                <TicketCheck aria-hidden />
                {booking.statusLabel}
              </Badge>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail label="Customer" value={booking.customerName} />
              <Detail label="Phone" value={formatPhone(booking.customerPhone)} />
              <Detail
                label="Service"
                value={booking.serviceName}
                Icon={Sparkles}
              />
              <Detail label="Date" value={booking.dateLabel} Icon={CalendarDays} />
              <Detail
                label="Time"
                value={`${booking.startTime} – ${booking.endTime}`}
                Icon={Clock}
              />
              <Detail
                label="Deposit paid"
                value={
                  booking.depositPaid
                    ? formatKwacha(booking.amounts.depositNgwee)
                    : `${formatKwacha(booking.amounts.depositNgwee)} — not paid yet`
                }
              />
              <Detail
                label="Balance due at the studio"
                value={formatKwacha(booking.amounts.remainingNgwee)}
              />
              <Detail
                label="Total service"
                value={formatKwacha(booking.amounts.totalNgwee)}
              />
            </dl>

            {booking.notes ? (
              <p className="rounded-2xl bg-blush-50/70 p-4 text-sm text-ink-soft">
                <span className="font-medium text-ink">Your notes: </span>
                {booking.notes}
              </p>
            ) : null}

            <div className="rounded-2xl border border-blush-200 bg-white p-4">
              <p className="text-sm font-medium text-ink">Booking policy</p>
              <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
                {booking.policySnapshot
                  .split("\n")
                  .filter(Boolean)
                  .map((paragraph) => (
                    <li key={paragraph}>{paragraph}</li>
                  ))}
              </ul>
              <p className="mt-3 text-xs text-ink-muted">{cancellationPolicy}</p>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row">
              {booking.status === "CONFIRMED" ? (
                <Button asChild variant="secondary">
                  <a
                    href={icsDataUrl(
                      buildBookingIcs(booking, { businessName, timezone }),
                    )}
                    download={`${booking.reference}.ics`}
                  >
                    <CalendarPlus aria-hidden />
                    Add to Calendar
                  </a>
                </Button>
              ) : null}

              {booking.status === "PENDING_PAYMENT" ? (
                <Button asChild>
                  <Link href="/book">Finish booking</Link>
                </Button>
              ) : null}

              {canCancel ? (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="secondary">
                      <XCircle aria-hidden />
                      Cancel appointment
                    </Button>
                  </DialogTrigger>
                  <DialogContent
                    title="Cancel this appointment?"
                    description="Your slot will be released for someone else."
                  >
                    <p className="text-sm text-ink-soft">{cancellationPolicy}</p>
                    <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                      <Button
                        variant="danger"
                        full
                        loading={cancelling}
                        loadingText="Cancelling…"
                        onClick={cancelBooking}
                      >
                        Yes, cancel it
                      </Button>
                      <DialogClose asChild>
                        <Button variant="secondary" full>
                          Keep my appointment
                        </Button>
                      </DialogClose>
                    </div>
                  </DialogContent>
                </Dialog>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Detail({
  label,
  value,
  Icon,
}: {
  label: string;
  value: string;
  Icon?: typeof CalendarDays;
}) {
  return (
    <div className="space-y-0.5">
      <dt className="flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-ink-muted">
        {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
        {label}
      </dt>
      <dd className="text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}
