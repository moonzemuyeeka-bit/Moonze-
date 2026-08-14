import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, MapPin, PackageCheck, Truck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/feedback";
import { StatCard } from "@/components/ui/stat-card";
import { formatDate } from "@/components/ui/timeline";
import { requirePageDeliveryProvider } from "@/lib/auth/guards";
import {
  countProviderJobs,
  getProviderProfile,
  listAvailableJobs,
  listServiceAreas,
  listVehicles,
} from "@/server/delivery/queries";
import { formatZmw } from "@/lib/money";
import { VERIFICATION_STATUS_LABELS, VERIFICATION_STATUS_TONES } from "@/lib/labels";
import { ClaimJobForm } from "./job-actions";

export const metadata: Metadata = {
  title: "Available delivery jobs",
  description: "Delivery work waiting to be picked up in the areas you serve.",
};

/**
 * The transporter's job board.
 *
 * Everything a driver needs to decide whether a job is worth taking is on the
 * card — where to collect, where to deliver, how many lines, what it pays — so
 * they never have to open a job to find out it is across the country.
 */
export default async function DeliveryJobsPage() {
  const { providerId } = await requirePageDeliveryProvider("/delivery");

  const [provider, jobs, counts, vehicles, areas] = await Promise.all([
    getProviderProfile(providerId),
    listAvailableJobs(providerId),
    countProviderJobs(providerId),
    listVehicles(providerId),
    listServiceAreas(providerId),
  ]);

  const activeVehicles = vehicles
    .filter((vehicle) => vehicle.isActive)
    .map((vehicle) => ({ id: vehicle.id, type: vehicle.type, registration: vehicle.registration }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Available jobs"
        description={`Deliveries waiting for a transporter in the ${areas.length === 1 ? "area" : "areas"} you serve.`}
        actions={
          <Badge tone={VERIFICATION_STATUS_TONES[provider.verificationStatus]} size="md">
            {VERIFICATION_STATUS_LABELS[provider.verificationStatus]}
          </Badge>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Waiting for a transporter" value={counts.available} icon={Truck} tone="gold" />
        <StatCard
          label="Jobs in progress"
          value={counts.active}
          icon={ClipboardList}
          href="/delivery/assigned"
        />
        <StatCard label="Delivered" value={counts.completed} icon={PackageCheck} tone="success" />
      </div>

      {!provider.isAcceptingJobs ? (
        <Alert tone="warning" title="You are marked as not accepting work">
          New jobs will not be offered to you until you turn that back on in{" "}
          <Link href="/delivery/settings" className="font-medium underline">
            your settings
          </Link>
          .
        </Alert>
      ) : null}

      {areas.length === 0 ? (
        <Alert tone="info" title="Tell BuildLink where you deliver">
          Jobs are matched to the provinces and districts you cover.{" "}
          <Link href="/delivery/areas" className="font-medium underline">
            Add a service area
          </Link>{" "}
          to start seeing work.
        </Alert>
      ) : null}

      {activeVehicles.length === 0 ? (
        <Alert tone="info" title="Add a vehicle">
          Customers and suppliers see which vehicle is bringing their materials.{" "}
          <Link href="/delivery/fleet" className="font-medium underline">
            Add your first vehicle
          </Link>
          .
        </Alert>
      ) : null}

      {jobs.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No jobs waiting right now"
          description="When a supplier needs a third-party transporter in one of your areas, the job appears here. Suppliers can also assign a job to you directly."
          action={
            <Button asChild variant="outline">
              <Link href="/delivery/areas">Review your service areas</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {jobs.map((job) => (
            <li key={job.id}>
              <Card>
                <CardContent className="space-y-4 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">Order {job.orderNumber}</p>
                      <p className="text-xs text-foreground-muted">
                        {job.itemCount} {job.itemCount === 1 ? "line" : "lines"} · goods worth{" "}
                        {formatZmw(job.totalMinor)} · posted {formatDate(job.createdAt)}
                      </p>
                    </div>
                    <p className="text-right">
                      <span className="tabular block text-base font-semibold text-brand-800">
                        {job.feeMinor > 0 ? formatZmw(job.feeMinor) : "Fee to agree"}
                      </span>
                      <span className="text-xs text-foreground-muted">delivery fee</span>
                    </p>
                  </div>

                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <Leg
                      label="Collect from"
                      name={job.supplierName}
                      detail={job.supplierAddress}
                      phone={job.supplierPhone}
                    />
                    <Leg
                      label="Deliver to"
                      name={[job.addressLine, job.locationDetail].filter(Boolean).join(", ")}
                      detail={
                        job.districtName ? `${job.districtName}, ${job.provinceName}` : job.provinceName
                      }
                    />
                  </dl>

                  <ClaimJobForm deliveryId={job.id} vehicles={activeVehicles} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-foreground-muted">
        The delivery fee is paid by the customer to you as agreed with the supplier. BuildLink
        records the job and its proof of delivery; it does not hold the money.
      </p>
    </div>
  );
}

function Leg({
  label,
  name,
  detail,
  phone,
}: {
  label: string;
  name: string;
  detail?: string | null;
  phone?: string;
}) {
  return (
    <div className="rounded-lg bg-surface-muted p-3">
      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-foreground-subtle">
        <MapPin aria-hidden className="size-3.5" />
        {label}
      </dt>
      <dd className="mt-1 space-y-0.5">
        <p className="text-sm font-medium text-foreground">{name}</p>
        {detail ? <p className="text-xs text-foreground-muted">{detail}</p> : null}
        {phone ? <p className="text-xs text-foreground-muted">{phone}</p> : null}
      </dd>
    </div>
  );
}
