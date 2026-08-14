import type { Metadata } from "next";
import { BookingLookup } from "@/components/booking/booking-lookup";
import { getSettings } from "@/lib/database/settings";

export const metadata: Metadata = {
  title: "My booking",
  description:
    "Look up your Koko's Bookings appointment with your booking reference and phone number.",
};

export const dynamic = "force-dynamic";

export default async function MyBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const [{ ref }, settings] = await Promise.all([searchParams, getSettings()]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="space-y-2">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">My booking</h1>
        <p className="text-ink-soft">
          Enter your booking reference and the mobile number you booked with to see your
          appointment, deposit and balance.
        </p>
      </div>

      <div className="mt-8">
        <BookingLookup
          businessName={settings.businessName}
          timezone={settings.timezone}
          cancellationPolicy={settings.cancellationPolicy}
          defaultReference={ref}
        />
      </div>
    </div>
  );
}
