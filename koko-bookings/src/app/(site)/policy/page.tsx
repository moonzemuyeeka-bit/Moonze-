import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getBusinessConfig, policyParagraphs } from "@/lib/database/settings";
import { formatKwacha } from "@/lib/money";

export const metadata: Metadata = {
  title: "Booking & deposit policy",
  description:
    "How deposits, cancellations and rescheduling work at Koko's Bookings.",
};

export default async function PolicyPage() {
  const config = await getBusinessConfig();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-3xl text-ink sm:text-4xl">
        Booking &amp; deposit policy
      </h1>
      <p className="mt-2 text-ink-soft">
        Everything you agree to when you secure an appointment with a{" "}
        {formatKwacha(config.depositNgwee)} deposit.
      </p>

      <Card className="mt-8">
        <CardContent className="space-y-4 p-6 pt-6">
          <h2 className="flex items-center gap-2 font-display text-xl text-ink">
            <ShieldCheck className="size-5 text-blush-500" aria-hidden />
            Booking Deposit Policy
          </h2>
          <ul className="space-y-3 text-sm leading-relaxed text-ink-soft">
            {policyParagraphs(config).map((paragraph) => (
              <li key={paragraph} className="flex gap-2.5">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-blush-400" />
                <span>{paragraph}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="space-y-3 p-6 pt-6">
          <h2 className="font-display text-xl text-ink">Cancellations &amp; rescheduling</h2>
          <p className="text-sm leading-relaxed text-ink-soft">
            {config.cancellationPolicy}
          </p>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="space-y-3 p-6 pt-6">
          <h2 className="font-display text-xl text-ink">Good to know</h2>
          <ul className="space-y-2 text-sm leading-relaxed text-ink-soft">
            <li>
              Appointments can be booked up to {config.bookingWindowDays} days ahead, and
              at least {config.minNoticeHours} hour
              {config.minNoticeHours === 1 ? "" : "s"} before the start time.
            </li>
            <li>
              While you pay, your slot is held for {config.reservationMinutes} minutes. If
              the payment is not completed the slot is released for someone else.
            </li>
            <li>
              We leave {config.bufferMinutes} minutes between appointments for cleaning and
              set-up.
            </li>
            <li>
              Questions? Call {config.businessPhone} or email {config.businessEmail}.
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/book">Book an appointment</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/my-booking">Manage my booking</Link>
        </Button>
      </div>
    </div>
  );
}
