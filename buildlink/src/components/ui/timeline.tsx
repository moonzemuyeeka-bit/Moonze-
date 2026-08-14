import * as React from "react";
import { Check, Circle, Dot, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimelineStep } from "@/lib/domain/order-status";

/**
 * Order / delivery timeline.
 *
 * Renders as an ordered list so assistive technology reads it as the sequence
 * it is, with the state of each step spelled out in text rather than conveyed by
 * colour alone.
 */
export function Timeline({
  steps,
  className,
}: {
  steps: TimelineStep[];
  className?: string;
}) {
  return (
    <ol className={cn("space-y-0", className)}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <li key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border-2",
                  step.state === "done" && "border-brand-600 bg-brand-600 text-white",
                  step.state === "current" && "border-gold-500 bg-gold-50 text-gold-700",
                  step.state === "upcoming" && "border-border-strong bg-surface text-ink-400",
                  step.state === "failed" && "border-danger-500 bg-danger-50 text-danger-700",
                )}
              >
                {step.state === "done" ? (
                  <Check aria-hidden className="size-4" />
                ) : step.state === "failed" ? (
                  <X aria-hidden className="size-4" />
                ) : step.state === "current" ? (
                  <Dot aria-hidden className="size-5" />
                ) : (
                  <Circle aria-hidden className="size-2.5" />
                )}
              </span>
              {!isLast ? (
                <span
                  className={cn(
                    "my-1 w-0.5 flex-1",
                    step.state === "done" ? "bg-brand-300" : "bg-border",
                  )}
                />
              ) : null}
            </div>

            <div className={cn("min-w-0 pb-5", isLast && "pb-0")}>
              <p
                className={cn(
                  "text-sm font-medium",
                  step.state === "upcoming" ? "text-foreground-subtle" : "text-foreground",
                )}
              >
                {step.label}
                <span className="sr-only">
                  {" — "}
                  {step.state === "done"
                    ? "completed"
                    : step.state === "current"
                      ? "in progress"
                      : step.state === "failed"
                        ? "did not complete"
                        : "not started"}
                </span>
              </p>
              {step.at ? (
                <time
                  dateTime={step.at.toISOString()}
                  className="text-xs text-foreground-muted"
                >
                  {formatTimestamp(step.at)}
                </time>
              ) : null}
              {step.note ? (
                <p className="mt-1 text-xs text-foreground-muted">{step.note}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const timestampFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Lusaka",
});

/** Formatted in Lusaka time so timestamps read the same for everyone involved. */
export function formatTimestamp(date: Date): string {
  return timestampFormatter.format(date);
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Lusaka",
});

export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}
