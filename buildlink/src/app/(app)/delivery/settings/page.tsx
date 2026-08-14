import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { StarRating } from "@/components/ui/star-rating";
import { formatDate } from "@/components/ui/timeline";
import { requirePageDeliveryProvider } from "@/lib/auth/guards";
import { getProviderProfile } from "@/server/delivery/queries";
import {
  DELIVERY_PROVIDER_TYPE_LABELS,
  VERIFICATION_STATUS_EXPLAINERS,
  VERIFICATION_STATUS_LABELS,
  VERIFICATION_STATUS_TONES,
} from "@/lib/labels";
import { ProviderSettingsForm } from "./settings-form";

export const metadata: Metadata = {
  title: "Transport settings",
  description: "Your transport business details, rates and availability.",
};

export default async function DeliverySettingsPage() {
  const { providerId } = await requirePageDeliveryProvider("/delivery/settings");
  const provider = await getProviderProfile(providerId);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Transport settings"
        description={`${DELIVERY_PROVIDER_TYPE_LABELS[provider.type]} on BuildLink since ${formatDate(provider.createdAt)}.`}
        actions={
          <Badge tone={VERIFICATION_STATUS_TONES[provider.verificationStatus]} size="md">
            {VERIFICATION_STATUS_LABELS[provider.verificationStatus]}
          </Badge>
        }
      />

      <Alert
        tone={provider.verificationStatus === "VERIFIED" ? "success" : "info"}
        title={VERIFICATION_STATUS_LABELS[provider.verificationStatus]}
      >
        {VERIFICATION_STATUS_EXPLAINERS[provider.verificationStatus]}
      </Alert>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Deliveries completed" value={String(provider.completedDeliveries)} />
        <Stat
          label="Rating"
          value={
            provider.ratingCount === 0 ? (
              "No ratings yet"
            ) : (
              <StarRating ratingBps={provider.ratingAverageBps} reviewCount={provider.ratingCount} />
            )
          }
        />
        <Stat
          label="Availability"
          value={provider.isAcceptingJobs ? "Accepting jobs" : "Not accepting jobs"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-base">
            Business details
          </CardTitle>
          <CardDescription>
            Suppliers see these when they choose a transporter for a delivery.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProviderSettingsForm provider={provider} />
        </CardContent>
      </Card>

      <p className="text-xs text-foreground-muted">
        Need to change where you deliver? That lives in{" "}
        <Link href="/delivery/areas" className="font-medium underline">
          service areas
        </Link>
        .
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
