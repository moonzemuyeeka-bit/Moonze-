import type { Metadata } from "next";
import { BookingFlow, type BookingFlowConfig } from "@/components/booking/booking-flow";
import { EmptyState } from "@/components/ui/empty-state";
import { isDemoMode } from "@/lib/config";
import { listActiveServices } from "@/lib/database/services";
import { getBusinessConfig, policyParagraphs } from "@/lib/database/settings";
import { SANDBOX_TEST_CARDS } from "@/lib/payments/mock-provider";
import { getPaymentProvider } from "@/lib/payments/provider";
import { addDaysToDateKey, businessNow, monthKeyForDateKey } from "@/lib/time";

export const metadata: Metadata = {
  title: "Book an appointment",
  description:
    "Choose your lash set, pick an open time and secure your appointment with a K50 deposit paid by Mobile Money or bank card.",
};

export const dynamic = "force-dynamic";

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const { service: requestedService } = await searchParams;
  const [services, config] = await Promise.all([
    listActiveServices(),
    getBusinessConfig(),
  ]);

  if (services.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
        <EmptyState
          title="Online booking is paused"
          description="No services are bookable right now. Please call the studio and we will help you book."
        />
      </div>
    );
  }

  const today = businessNow(config.timezone).date;
  const provider = getPaymentProvider();

  const flowConfig: BookingFlowConfig = {
    businessName: config.businessName,
    timezone: config.timezone,
    depositNgwee: config.depositNgwee,
    policyParagraphs: policyParagraphs(config),
    currentMonth: monthKeyForDateKey(today),
    maxMonth: monthKeyForDateKey(addDaysToDateKey(today, config.bookingWindowDays)),
    bookingWindowDays: config.bookingWindowDays,
    reservationMinutes: config.reservationMinutes,
    // In sandbox mode the provider's test cards stand in for its hosted fields.
    sandboxCards: provider.sandbox
      ? SANDBOX_TEST_CARDS.map(({ token, brand, last4, label, description }) => ({
          token,
          brand,
          last4,
          label,
          description,
        }))
      : [],
    sandboxMode: provider.sandbox && isDemoMode(),
  };

  const initialService =
    services.find((entry) => entry.slug === requestedService)?.id ?? null;

  return (
    <BookingFlow
      services={services}
      config={flowConfig}
      initialServiceId={initialService}
    />
  );
}
