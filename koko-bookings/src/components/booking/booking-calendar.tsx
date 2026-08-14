"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  AvailabilityLegend,
  DAY_STATUS_STYLES,
} from "@/components/booking/availability-legend";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { addMonths, dayOfWeekForDateKey, formatMonthLabel, monthKeyForDateKey } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { CalendarDayDto } from "@/types";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Monday-first column index for a date. */
function columnFor(date: string): number {
  return (dayOfWeekForDateKey(date) + 6) % 7;
}

export function BookingCalendar({
  month,
  days,
  selectedDate,
  loading,
  error,
  minMonth,
  maxMonth,
  onMonthChange,
  onSelect,
}: {
  month: string;
  days: CalendarDayDto[];
  selectedDate: string | null;
  loading: boolean;
  error: string | null;
  minMonth: string;
  maxMonth: string;
  onMonthChange: (month: string) => void;
  onSelect: (date: string) => void;
}) {
  const leadingBlanks = days.length > 0 ? columnFor(days[0].date) : 0;
  const canGoBack = month > minMonth;
  const canGoForward = month < maxMonth;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="secondary"
          size="icon"
          onClick={() => onMonthChange(addMonths(month, -1))}
          disabled={!canGoBack || loading}
          aria-label="Previous month"
        >
          <ChevronLeft aria-hidden />
        </Button>

        <p aria-live="polite" className="font-display text-lg text-ink">
          {formatMonthLabel(month)}
        </p>

        <Button
          variant="secondary"
          size="icon"
          onClick={() => onMonthChange(addMonths(month, 1))}
          disabled={!canGoForward || loading}
          aria-label="Next month"
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>

      {error ? (
        <Alert tone="danger" title="We could not load the calendar">
          <p>{error}</p>
        </Alert>
      ) : null}

      <div
        className="grid grid-cols-7 gap-1 text-center text-[0.7rem] font-medium uppercase tracking-wide text-ink-muted"
        aria-hidden
      >
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="py-1">
            {label}
          </span>
        ))}
      </div>

      {loading && days.length === 0 ? (
        <div className="grid grid-cols-7 gap-1" aria-hidden>
          {Array.from({ length: 35 }).map((_, index) => (
            <Skeleton key={index} className="aspect-square rounded-xl" />
          ))}
        </div>
      ) : (
        <div
          role="group"
          aria-label={`Availability for ${formatMonthLabel(month)}`}
          className={cn("grid grid-cols-7 gap-1 transition-opacity", loading && "opacity-60")}
        >
          {Array.from({ length: leadingBlanks }).map((_, index) => (
            <span key={`blank-${index}`} aria-hidden />
          ))}

          {days.map((day) => {
            const { label, Icon, cell } = DAY_STATUS_STYLES[day.status];
            const selectable = day.status === "AVAILABLE" || day.status === "LIMITED";
            const selected = day.date === selectedDate;
            const dayNumber = Number(day.date.slice(-2));

            return (
              <button
                key={day.date}
                type="button"
                disabled={!selectable}
                onClick={() => onSelect(day.date)}
                aria-pressed={selected}
                aria-label={`${dayNumber} ${formatMonthLabel(monthKeyForDateKey(day.date))} — ${label}${
                  selectable ? `, ${day.availableSlots} times open` : ""
                }${day.reason && !selectable ? `, ${day.reason}` : ""}`}
                title={day.reason ?? label}
                className={cn(
                  "flex aspect-square min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl border text-sm transition-all duration-150",
                  cell,
                  selectable && "cursor-pointer",
                  !selectable && "cursor-not-allowed",
                  selected &&
                    "border-blush-600 bg-linear-to-br from-blush-500 to-blush-600 text-white shadow-soft hover:from-blush-600",
                )}
              >
                <span className="font-medium leading-none">{dayNumber}</span>
                <Icon
                  className={cn("size-3", selected ? "text-white" : undefined)}
                  aria-hidden
                />
                <span className="sr-only">{label}</span>
              </button>
            );
          })}
        </div>
      )}

      <AvailabilityLegend />
    </div>
  );
}
