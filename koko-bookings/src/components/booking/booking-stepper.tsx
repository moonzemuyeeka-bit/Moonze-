"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const BOOKING_STEPS = [
  { id: "service", label: "Service" },
  { id: "datetime", label: "Date & Time" },
  { id: "details", label: "Details" },
  { id: "payment", label: "Payment" },
  { id: "confirmed", label: "Confirmed" },
] as const;

export type BookingStepId = (typeof BOOKING_STEPS)[number]["id"];

export function stepIndex(step: BookingStepId): number {
  return BOOKING_STEPS.findIndex((entry) => entry.id === step);
}

/**
 * Progress through the booking. Completed steps can be revisited, which keeps
 * earlier selections intact instead of restarting the flow.
 */
export function BookingStepper({
  current,
  onStepSelect,
}: {
  current: BookingStepId;
  onStepSelect?: (step: BookingStepId) => void;
}) {
  const currentIndex = stepIndex(current);

  return (
    <nav aria-label="Booking progress">
      <ol className="flex items-center gap-1.5 sm:gap-2">
        {BOOKING_STEPS.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          const canRevisit = done && Boolean(onStepSelect) && current !== "confirmed";

          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-center gap-1.5">
              <button
                type="button"
                disabled={!canRevisit}
                onClick={canRevisit ? () => onStepSelect?.(step.id) : undefined}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-start gap-1.5 rounded-xl px-1 py-1 text-left transition-opacity",
                  canRevisit && "hover:opacity-80",
                  !canRevisit && "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-full rounded-full transition-colors",
                    done || active ? "bg-blush-500" : "bg-blush-100",
                  )}
                />
                <span
                  className={cn(
                    "flex items-center gap-1 truncate text-[0.7rem] font-medium sm:text-xs",
                    active ? "text-blush-700" : done ? "text-ink-soft" : "text-ink-muted",
                  )}
                >
                  {done ? <Check className="size-3" aria-hidden /> : null}
                  <span className="truncate">{step.label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
