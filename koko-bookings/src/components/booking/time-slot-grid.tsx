"use client";

import { CalendarClock } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingRow, SkeletonGrid } from "@/components/ui/skeleton";
import { formatDateShort } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { SlotDto } from "@/types";

/**
 * Start times for the chosen date. Unavailable times stay visible but disabled
 * with the reason spelled out, so the day still reads as a real schedule.
 */
export function TimeSlotGrid({
  slots,
  selectedTime,
  loading,
  error,
  suggestions = [],
  onSelect,
  onPickSuggestion,
}: {
  slots: SlotDto[];
  selectedTime: string | null;
  loading: boolean;
  error: string | null;
  suggestions?: string[];
  onSelect: (time: string) => void;
  onPickSuggestion?: (date: string) => void;
}) {
  if (loading && slots.length === 0) {
    return (
      <div className="space-y-3">
        <LoadingRow label="Checking availability…" />
        <SkeletonGrid count={6} className="grid-cols-2 sm:grid-cols-3" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert tone="danger" title="We could not check availability">
        <p>{error}</p>
      </Alert>
    );
  }

  const hasAvailable = slots.some((slot) => slot.available);

  if (slots.length === 0 || !hasAvailable) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={<CalendarClock />}
          title={slots.length === 0 ? "No available appointments on this date." : "No available times left on this date."}
          description="Choose another date and we will show you what is open."
        />
        {suggestions.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">Next available dates</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((date) => (
                <Button
                  key={date}
                  variant="outline"
                  size="sm"
                  onClick={() => onPickSuggestion?.(date)}
                >
                  {formatDateShort(date)}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {loading ? <LoadingRow label="Re-checking availability…" /> : null}
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {slots.map((slot) => {
          const selected = slot.startTime === selectedTime;
          return (
            <li key={slot.startTime}>
              <button
                type="button"
                disabled={!slot.available}
                onClick={() => onSelect(slot.startTime)}
                aria-pressed={selected}
                aria-label={`${slot.startTime} — ${slot.available ? "Available" : slot.reason ?? "Unavailable"}`}
                className={cn(
                  "flex min-h-14 w-full flex-col items-center justify-center rounded-2xl border px-2 py-2 transition-all duration-150",
                  slot.available
                    ? "border-line bg-white text-ink hover:-translate-y-0.5 hover:border-blush-400 hover:shadow-soft"
                    : "cursor-not-allowed border-dashed border-line bg-blush-50/40 text-ink-muted",
                  selected &&
                    "border-blush-600 bg-linear-to-br from-blush-500 to-blush-600 text-white shadow-soft",
                )}
              >
                <span className="text-base font-medium leading-none">{slot.startTime}</span>
                <span
                  className={cn(
                    "mt-1 text-[0.7rem]",
                    selected ? "text-white/85" : slot.available ? "text-mint-700" : "text-ink-muted",
                  )}
                >
                  {slot.available ? "Available" : slot.reason ?? "Unavailable"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
