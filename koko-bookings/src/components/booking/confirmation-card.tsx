"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarPlus,
  CheckCircle2,
  Copy,
  PartyPopper,
  Share2,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { buildBookingIcs, icsDataUrl } from "@/lib/calendar";
import { formatKwacha } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { BookingDto } from "@/types";

/** The reward at the end of the flow: everything the customer needs, at a glance. */
export function ConfirmationCard({
  booking,
  businessName,
  timezone,
  onBookAnother,
}: {
  booking: BookingDto;
  businessName: string;
  timezone: string;
  onBookAnother?: () => void;
}) {
  const [shareNote, setShareNote] = useState<string | null>(null);

  const shareText = `My ${businessName} appointment: ${booking.serviceName} on ${booking.dateLabel} at ${booking.startTime}. Reference ${booking.reference}.`;

  async function share() {
    const canShareNatively = typeof navigator.share === "function";
    try {
      if (canShareNatively) {
        await navigator.share({ title: `${businessName} appointment`, text: shareText });
        return;
      }
      await navigator.clipboard.writeText(shareText);
      setShareNote("Booking details copied to your clipboard.");
    } catch {
      setShareNote("Copy this: " + shareText);
    }
  }

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(booking.reference);
      setShareNote(`Reference ${booking.reference} copied.`);
    } catch {
      setShareNote(`Your reference is ${booking.reference}.`);
    }
  }

  const rows = [
    { label: "Service", value: booking.serviceName },
    { label: "Date", value: booking.dateLabel },
    { label: "Time", value: `${booking.startTime} – ${booking.endTime}` },
    { label: "Deposit Paid", value: formatKwacha(booking.amounts.depositNgwee) },
    { label: "Remaining Balance", value: formatKwacha(booking.amounts.remainingNgwee) },
  ];

  return (
    <div className="space-y-5">
      <div className="animate-pop text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-mint-50 text-mint-500">
          <CheckCircle2 className="size-9" aria-hidden />
        </span>
        <h1 className="mt-4 flex items-center justify-center gap-2 font-display text-3xl text-ink">
          Appointment Confirmed
          <PartyPopper className="size-6 text-blush-500" aria-hidden />
        </h1>
        <p className="mt-2 text-ink-soft">
          We have sent your details to {booking.customerPhone}. See you soon!
        </p>
      </div>

      <Card className="bg-white/90">
        <CardContent className="space-y-5 p-6 pt-6">
          <div className="rounded-2xl border border-blush-200 bg-blush-50 p-4 text-center">
            <p className="text-xs uppercase tracking-[0.16em] text-blush-700">
              Booking reference
            </p>
            <p className="mt-1 font-display text-3xl tracking-wide text-blush-900">
              {booking.reference}
            </p>
            <Button variant="link" size="sm" className="mt-1" onClick={copyReference}>
              <Copy aria-hidden /> Copy reference
            </Button>
          </div>

          <dl className="divide-y divide-line">
            {rows.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-3 py-2.5">
                <dt className="text-sm text-ink-soft">{row.label}</dt>
                <dd className="text-right text-sm font-medium text-ink">{row.value}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-sm text-ink-soft">Status</dt>
              <dd>
                <Badge tone="success">
                  <CheckCircle2 aria-hidden />
                  {booking.statusLabel.toUpperCase()}
                </Badge>
              </dd>
            </div>
          </dl>

          <p className="rounded-2xl bg-blush-50/70 p-4 text-sm text-ink-soft">
            Please arrive with clean lashes and no eye make-up. The remaining{" "}
            {formatKwacha(booking.amounts.remainingNgwee)} is payable at the studio.
          </p>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <Button asChild variant="secondary">
              <a
                href={icsDataUrl(
                  buildBookingIcs(booking, { businessName, timezone, location: "Lusaka, Zambia" }),
                )}
                download={`${booking.reference}.ics`}
              >
                <CalendarPlus aria-hidden />
                Add to Calendar
              </a>
            </Button>

            <Button variant="secondary" onClick={share}>
              <Share2 aria-hidden />
              Share Booking
            </Button>

            <Button asChild variant="secondary">
              <Link href={`/my-booking?ref=${booking.reference}`}>View Booking</Link>
            </Button>

            {onBookAnother ? (
              <Button onClick={onBookAnother}>
                <Sparkles aria-hidden />
                Book Another
              </Button>
            ) : (
              <Button asChild>
                <Link href="/book">
                  <Sparkles aria-hidden />
                  Book Another
                </Link>
              </Button>
            )}
          </div>

          <p
            className={cn("text-center text-xs text-ink-muted", !shareNote && "sr-only")}
            role="status"
            aria-live="polite"
          >
            {shareNote}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
