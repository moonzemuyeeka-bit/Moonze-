"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  CalendarCheck,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  RefreshCw,
  Trash2,
  Unlock,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { formatKwacha } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import {
  addMonths,
  dayOfWeekForDateKey,
  formatDateLong,
  formatMonthLabel,
} from "@/lib/time";
import { cn } from "@/lib/utils";

export type AdminCalendarBooking = {
  id: string;
  reference: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  statusLabel: string;
  serviceName: string;
  customerName: string;
  customerPhone: string;
  depositNgwee: number;
  remainingNgwee: number;
};

export type AdminCalendarSlot = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "OPEN" | "BLOCKED";
  note: string | null;
};

export type AdminCalendarDay = {
  date: string;
  weekdayClosed: boolean;
  blocked: boolean;
  blockReason: string | null;
  bookings: number;
  availableSlots: number;
  totalSlots: number;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const BLOCK_REASONS = ["Personal day", "Fully booked", "Holiday", "Training", "Sick day"];

/**
 * The owner's calendar: see the month, open or close a date, and hand-craft the
 * slots for a single day.
 */
export function AdminCalendar({
  month,
  days,
  bookings,
  slots,
  selectedDate,
}: {
  month: string;
  days: AdminCalendarDay[];
  bookings: AdminCalendarBooking[];
  slots: AdminCalendarSlot[];
  selectedDate: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [reason, setReason] = useState(BLOCK_REASONS[0]);
  const [slotStart, setSlotStart] = useState("09:00");
  const [slotEnd, setSlotEnd] = useState("11:00");

  const selected = days.find((day) => day.date === selectedDate);
  const dayBookings = useMemo(
    () => bookings.filter((booking) => booking.date === selectedDate),
    [bookings, selectedDate],
  );
  const daySlots = useMemo(
    () => slots.filter((slot) => slot.date === selectedDate),
    [slots, selectedDate],
  );
  const leadingBlanks = days.length > 0 ? (dayOfWeekForDateKey(days[0].date) + 6) % 7 : 0;

  function navigate(params: Record<string, string>) {
    const search = new URLSearchParams({ month, date: selectedDate, ...params });
    router.push(`/admin/calendar?${search.toString()}`);
  }

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      setNote(await action());
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const setDayStatus = (status: "AVAILABLE" | "UNAVAILABLE") =>
    run(async () => {
      await apiRequest("/api/admin/availability", {
        method: "POST",
        json: {
          date: selectedDate,
          status,
          ...(status === "UNAVAILABLE" ? { reason } : {}),
        },
      });
      return status === "UNAVAILABLE"
        ? `${formatDateLong(selectedDate)} is now closed for bookings.`
        : `${formatDateLong(selectedDate)} is open for bookings again.`;
    });

  const addSlot = () =>
    run(async () => {
      await apiRequest("/api/admin/time-slots", {
        method: "POST",
        json: { date: selectedDate, startTime: slotStart, endTime: slotEnd, status: "OPEN" },
      });
      return `Added a slot at ${slotStart}.`;
    });

  const toggleSlot = (slot: AdminCalendarSlot) =>
    run(async () => {
      await apiRequest("/api/admin/time-slots", {
        method: "PATCH",
        json: { id: slot.id, status: slot.status === "OPEN" ? "BLOCKED" : "OPEN" },
      });
      return slot.status === "OPEN"
        ? `Blocked the ${slot.startTime} slot.`
        : `Reopened the ${slot.startTime} slot.`;
    });

  const removeSlot = (slot: AdminCalendarSlot) =>
    run(async () => {
      await apiRequest("/api/admin/time-slots", {
        method: "DELETE",
        json: { id: slot.id },
      });
      return `Removed the ${slot.startTime} slot.`;
    });

  return (
    <div className="space-y-4">
      {error ? (
        <Alert tone="danger" title="That did not work">
          <p>{error}</p>
        </Alert>
      ) : null}
      {note ? (
        <Alert tone="success" title="Saved">
          <p>{note}</p>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <Card>
          <CardContent className="space-y-4 p-4 pt-4 sm:p-5 sm:pt-5">
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="secondary"
                size="icon"
                aria-label="Previous month"
                onClick={() => navigate({ month: addMonths(month, -1) })}
              >
                <ChevronLeft aria-hidden />
              </Button>
              <p className="font-display text-lg text-ink">{formatMonthLabel(month)}</p>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Next month"
                onClick={() => navigate({ month: addMonths(month, 1) })}
              >
                <ChevronRight aria-hidden />
              </Button>
            </div>

            <div
              className="grid grid-cols-7 gap-1 text-center text-[0.7rem] uppercase tracking-wide text-ink-muted"
              aria-hidden
            >
              {WEEKDAYS.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: leadingBlanks }).map((_, index) => (
                <span key={`blank-${index}`} aria-hidden />
              ))}

              {days.map((day) => {
                const isSelected = day.date === selectedDate;
                const closed = day.blocked || day.weekdayClosed;
                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => navigate({ date: day.date })}
                    aria-pressed={isSelected}
                    aria-label={`${formatDateLong(day.date)} — ${
                      day.blocked
                        ? `closed: ${day.blockReason ?? "unavailable"}`
                        : day.weekdayClosed
                          ? "closed"
                          : `${day.bookings} booked, ${day.availableSlots} open`
                    }`}
                    className={cn(
                      "flex aspect-square min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl border p-1 text-sm transition-all",
                      closed
                        ? "border-line bg-blush-50/50 text-ink-muted"
                        : "border-line bg-white text-ink hover:border-blush-300",
                      isSelected && "border-blush-600 ring-2 ring-blush-300",
                    )}
                  >
                    <span className="font-medium leading-none">
                      {Number(day.date.slice(-2))}
                    </span>
                    {day.blocked ? (
                      <Ban className="size-3 text-rose-alert-500" aria-hidden />
                    ) : day.bookings > 0 ? (
                      <span className="rounded-full bg-blush-500 px-1.5 text-[0.6rem] font-semibold text-white">
                        {day.bookings}
                      </span>
                    ) : day.weekdayClosed ? (
                      <span className="text-[0.6rem] text-ink-muted">Closed</span>
                    ) : (
                      <span className="text-[0.6rem] text-mint-700">
                        {day.availableSlots} open
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
              <li className="flex items-center gap-1.5">
                <span className="rounded-full bg-blush-500 px-1.5 text-[0.6rem] font-semibold text-white">
                  n
                </span>
                Bookings that day
              </li>
              <li className="flex items-center gap-1.5">
                <Ban className="size-3.5 text-rose-alert-500" aria-hidden />
                Closed by you
              </li>
              <li>Closed = outside working hours</li>
            </ul>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-4 pt-4 sm:p-5 sm:pt-5">
              <div>
                <h2 className="font-display text-lg text-ink">
                  {formatDateLong(selectedDate)}
                </h2>
                <p className="text-sm text-ink-soft">
                  {selected?.blocked
                    ? `Closed — ${selected.blockReason ?? "unavailable"}`
                    : selected?.weekdayClosed
                      ? "Outside your working hours"
                      : `${selected?.bookings ?? 0} booked · ${selected?.availableSlots ?? 0} open`}
                </p>
              </div>

              {selected?.blocked ? (
                <Button
                  full
                  loading={busy}
                  onClick={() => setDayStatus("AVAILABLE")}
                  loadingText="Reopening…"
                >
                  <RefreshCw aria-hidden />
                  Reopen this date
                </Button>
              ) : (
                <div className="space-y-3">
                  <Field label="Reason (optional)" htmlFor="block-reason">
                    <Select
                      id="block-reason"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    >
                      {BLOCK_REASONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Button
                    variant="secondary"
                    full
                    loading={busy}
                    loadingText="Closing…"
                    onClick={() => setDayStatus("UNAVAILABLE")}
                  >
                    <Ban aria-hidden />
                    Mark unavailable
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-4 pt-4 sm:p-5 sm:pt-5">
              <h2 className="flex items-center gap-2 font-display text-lg text-ink">
                <Clock className="size-4 text-blush-500" aria-hidden />
                Custom time slots
              </h2>
              <p className="text-xs text-ink-muted">
                Adding slots to a date replaces that day&apos;s generated grid, so you
                control the start times exactly.
              </p>

              {daySlots.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-blush-200 p-3 text-sm text-ink-soft">
                  This date uses your working hours and slot interval.
                </p>
              ) : (
                <ul className="space-y-2">
                  {daySlots.map((slot) => (
                    <li
                      key={slot.id}
                      className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-white p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">
                          {slot.startTime} – {slot.endTime}
                        </p>
                        <Badge tone={slot.status === "OPEN" ? "success" : "danger"}>
                          {slot.status === "OPEN" ? "Open" : "Blocked"}
                        </Badge>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={
                            slot.status === "OPEN"
                              ? `Block the ${slot.startTime} slot`
                              : `Reopen the ${slot.startTime} slot`
                          }
                          disabled={busy}
                          onClick={() => toggleSlot(slot)}
                        >
                          {slot.status === "OPEN" ? <Lock aria-hidden /> : <Unlock aria-hidden />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove the ${slot.startTime} slot`}
                          disabled={busy}
                          onClick={() => removeSlot(slot)}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Field label="From" htmlFor="slot-start">
                  <Input
                    id="slot-start"
                    type="time"
                    value={slotStart}
                    onChange={(event) => setSlotStart(event.target.value)}
                  />
                </Field>
                <Field label="To" htmlFor="slot-end">
                  <Input
                    id="slot-end"
                    type="time"
                    value={slotEnd}
                    onChange={(event) => setSlotEnd(event.target.value)}
                  />
                </Field>
              </div>
              <Button variant="secondary" full loading={busy} onClick={addSlot}>
                <CalendarPlus aria-hidden />
                Add slot
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4 pt-4 sm:p-5 sm:pt-5">
          <h2 className="font-display text-lg text-ink">
            Bookings on {formatDateLong(selectedDate)}
          </h2>
          {dayBookings.length === 0 ? (
            <EmptyState
              icon={<CalendarCheck />}
              title="No appointments yet."
              description="Nothing is booked for this date."
            />
          ) : (
            <ul className="divide-y divide-line">
              {dayBookings.map((booking) => (
                <li key={booking.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="w-16 font-display text-lg text-blush-800">
                    {booking.startTime}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {booking.customerName} · {booking.serviceName}
                    </p>
                    <p className="truncate text-xs text-ink-soft">
                      {formatPhone(booking.customerPhone)} · {booking.reference} · balance{" "}
                      {formatKwacha(booking.remainingNgwee)}
                    </p>
                  </div>
                  <Badge
                    tone={
                      booking.status === "CONFIRMED"
                        ? "success"
                        : booking.status === "PENDING_PAYMENT"
                          ? "warning"
                          : booking.status === "NO_SHOW"
                            ? "danger"
                            : "brand"
                    }
                  >
                    {booking.statusLabel}
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
