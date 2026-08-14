"use client";

import { ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/field";
import { formatKwacha } from "@/lib/money";

/**
 * The deposit policy. It appears *before* the payment step and the customer has
 * to tick the box — the deposit is never buried inside the payment screen.
 */
export function BookingPolicy({
  paragraphs,
  depositNgwee,
  accepted,
  error,
  onAcceptedChange,
}: {
  paragraphs: string[];
  depositNgwee: number;
  accepted: boolean;
  error?: string;
  onAcceptedChange: (accepted: boolean) => void;
}) {
  return (
    <section
      aria-labelledby="booking-policy-heading"
      className="rounded-3xl border-2 border-blush-200 bg-linear-to-br from-blush-50 to-white p-5 shadow-soft sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-blush-100 text-blush-700">
          <ShieldCheck className="size-5" aria-hidden />
        </span>
        <div className="space-y-1">
          <h2 id="booking-policy-heading" className="font-display text-xl text-ink">
            Booking Deposit Policy
          </h2>
          <p className="text-sm font-medium text-blush-800">
            You are paying {formatKwacha(depositNgwee)} today to secure this appointment.
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2.5">
        {paragraphs.map((paragraph) => (
          <li key={paragraph} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-blush-400" />
            <span>{paragraph}</span>
          </li>
        ))}
      </ul>

      <label
        htmlFor="policy-accepted"
        className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-blush-200 bg-white p-4"
      >
        <Checkbox
          id="policy-accepted"
          checked={accepted}
          onCheckedChange={(value) => onAcceptedChange(value === true)}
          aria-describedby="policy-accepted-description"
          aria-invalid={Boolean(error)}
        />
        <span className="space-y-1">
          <span className="block text-sm font-medium text-ink">
            I have read and agree to the booking policy.
          </span>
          <span id="policy-accepted-description" className="block text-xs text-ink-muted">
            Required before you can pay the deposit.
          </span>
        </span>
      </label>

      <div className="mt-2">
        <FieldError message={error} />
      </div>
    </section>
  );
}
