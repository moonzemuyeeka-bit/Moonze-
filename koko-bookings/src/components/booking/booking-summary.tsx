"use client";

import { CalendarDays, Clock, Sparkles, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatKwacha } from "@/lib/money";
import { formatDateLong, formatDuration } from "@/lib/time";
import type { ServiceDto } from "@/types";

export type SummarySelection = {
  service: ServiceDto | null;
  date: string | null;
  time: string | null;
  depositNgwee: number;
};

/** The deposit breakdown: total, what is due today, and what is left. */
export function DepositBreakdown({
  totalNgwee,
  depositNgwee,
  compact = false,
}: {
  totalNgwee: number;
  depositNgwee: number;
  compact?: boolean;
}) {
  const deposit = Math.min(depositNgwee, totalNgwee);
  const rows = [
    { label: "Total Service", value: formatKwacha(totalNgwee), emphasis: false },
    { label: "Deposit Today", value: formatKwacha(deposit), emphasis: true },
    {
      label: "Balance After Deposit",
      value: formatKwacha(totalNgwee - deposit),
      emphasis: false,
    },
  ];

  return (
    <dl className={compact ? "space-y-1.5" : "space-y-2"}>
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-3">
          <dt className={row.emphasis ? "text-sm font-medium text-ink" : "text-sm text-ink-soft"}>
            {row.label}
          </dt>
          <dd
            className={
              row.emphasis
                ? "font-display text-lg text-blush-800"
                : "text-sm font-medium text-ink"
            }
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function BookingSummary({ selection }: { selection: SummarySelection }) {
  const { service, date, time, depositNgwee } = selection;

  return (
    <Card className="bg-white/85">
      <CardContent className="space-y-4 p-5 pt-5">
        <h2 className="font-display text-lg text-ink">Your booking</h2>

        <ul className="space-y-3 text-sm">
          <li className="flex items-start gap-2.5">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-blush-500" aria-hidden />
            <span>
              <span className="block text-ink-muted">Service</span>
              <span className="font-medium text-ink">
                {service ? service.name : "Not chosen yet"}
              </span>
              {service ? (
                <span className="block text-xs text-ink-muted">
                  {service.priceLabel} · {formatDuration(service.durationMinutes)}
                </span>
              ) : null}
            </span>
          </li>

          <li className="flex items-start gap-2.5">
            <CalendarDays className="mt-0.5 size-4 shrink-0 text-blush-500" aria-hidden />
            <span>
              <span className="block text-ink-muted">Date</span>
              <span className="font-medium text-ink">
                {date ? formatDateLong(date) : "Not chosen yet"}
              </span>
            </span>
          </li>

          <li className="flex items-start gap-2.5">
            <Clock className="mt-0.5 size-4 shrink-0 text-blush-500" aria-hidden />
            <span>
              <span className="block text-ink-muted">Time</span>
              <span className="font-medium text-ink">{time ?? "Not chosen yet"}</span>
            </span>
          </li>
        </ul>

        {service ? (
          <div className="rounded-2xl border border-blush-200 bg-blush-50/70 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-blush-700">
              <Wallet className="size-3.5" aria-hidden />
              Payment today
            </p>
            <DepositBreakdown
              totalNgwee={service.priceNgwee}
              depositNgwee={depositNgwee}
              compact
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Sticky bottom bar on phones: what you picked, what you pay, and the next
 * action — without covering the content above it.
 */
export function MobileBookingBar({
  selection,
  actionLabel,
  actionDisabled,
  loading,
  helper,
  onAction,
}: {
  selection: SummarySelection;
  actionLabel: string;
  actionDisabled?: boolean;
  loading?: boolean;
  helper?: string;
  onAction: () => void;
}) {
  const { service, date, time, depositNgwee } = selection;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-cream/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-float backdrop-blur-md lg:hidden">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">
            {service ? service.name : "Choose a service"}
          </p>
          <p className="truncate text-xs text-ink-muted">
            {date && time
              ? `${formatDateLong(date)} · ${time}`
              : helper ?? "Pick a date and time"}
          </p>
          {service ? (
            <p className="text-xs font-medium text-blush-700">
              Deposit: {formatKwacha(Math.min(depositNgwee, service.priceNgwee))}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onAction}
          disabled={actionDisabled || loading}
          className="min-h-12 shrink-0 rounded-full bg-linear-to-br from-blush-500 to-blush-600 px-6 text-sm font-medium text-white shadow-soft transition-all active:translate-y-px disabled:opacity-55"
        >
          {loading ? "Please wait…" : actionLabel}
        </button>
      </div>
    </div>
  );
}
