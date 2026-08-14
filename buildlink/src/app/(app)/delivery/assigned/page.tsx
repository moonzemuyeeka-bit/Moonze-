import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Truck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { formatDate, formatTimestamp } from "@/components/ui/timeline";
import { requirePageDeliveryProvider } from "@/lib/auth/guards";
import { listProviderDeliveries, type DeliveryJob } from "@/server/delivery/queries";
import { formatZmw } from "@/lib/money";
import { DELIVERY_STATUS_LABELS, DELIVERY_STATUS_TONES } from "@/lib/labels";

export const metadata: Metadata = {
  title: "My deliveries",
  description: "The delivery jobs you have taken, and the ones you have finished.",
};

/**
 * The transporter's own work.
 *
 * Active jobs first and in the order they were posted, because that is the order
 * a driver plans their day in; finished jobs are kept below as the record they
 * would point at in a dispute.
 */
export default async function AssignedDeliveriesPage() {
  const { providerId } = await requirePageDeliveryProvider("/delivery/assigned");

  const [active, history] = await Promise.all([
    listProviderDeliveries(providerId, { scope: "active" }),
    listProviderDeliveries(providerId, { scope: "history" }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="My deliveries"
        description="Update each job as you go — the customer and the supplier see it immediately."
        actions={
          <Button asChild variant="outline">
            <Link href="/delivery">Find more work</Link>
          </Button>
        }
      />

      {active.length === 0 && history.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No deliveries yet"
          description="Take a job from the board and it appears here with everything you need to complete it."
          action={
            <Button asChild>
              <Link href="/delivery">See available jobs</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">In progress</h2>
            {active.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border-strong bg-surface-muted p-4 text-sm text-foreground-muted">
                Nothing on the go. <Link href="/delivery" className="font-medium underline">Find a job</Link>.
              </p>
            ) : (
              <ul className="space-y-3">
                {active.map((job) => (
                  <JobRow key={job.id} job={job} />
                ))}
              </ul>
            )}
          </section>

          {history.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">Finished</h2>
              <ul className="space-y-3">
                {history.map((job) => (
                  <JobRow key={job.id} job={job} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function JobRow({ job }: { job: DeliveryJob }) {
  return (
    <li>
      <Card className="transition-shadow hover:shadow-card-hover">
        <CardContent className="p-4 sm:p-5">
          <Link href={`/delivery/assigned/${job.id}`} className="block space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Order {job.orderNumber}</p>
                <p className="text-xs text-foreground-muted">
                  {job.supplierName} → {job.districtName ? `${job.districtName}, ` : ""}
                  {job.provinceName}
                </p>
              </div>
              <Badge tone={DELIVERY_STATUS_TONES[job.status]}>
                {DELIVERY_STATUS_LABELS[job.status]}
              </Badge>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3">
              <p className="flex items-center gap-1.5 text-xs text-foreground-muted">
                <ClipboardList aria-hidden className="size-3.5" />
                {job.itemCount} {job.itemCount === 1 ? "line" : "lines"}
                {job.vehicleLabel ? ` · ${job.vehicleLabel}` : ""}
                {job.scheduledFor
                  ? ` · scheduled ${formatTimestamp(job.scheduledFor)}`
                  : ` · taken ${formatDate(job.createdAt)}`}
              </p>
              <p className="tabular text-sm font-semibold">
                {job.feeMinor > 0 ? formatZmw(job.feeMinor) : "Fee to agree"}
              </p>
            </div>
          </Link>
        </CardContent>
      </Card>
    </li>
  );
}
