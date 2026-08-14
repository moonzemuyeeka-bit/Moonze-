import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { MapPin, Package, Phone, Store } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Timeline, formatTimestamp } from "@/components/ui/timeline";
import { requirePageDeliveryProvider } from "@/lib/auth/guards";
import { getDeliveryDetail } from "@/server/delivery/queries";
import { requiresProofOfDelivery } from "@/lib/domain/delivery-status";
import { NotFoundError } from "@/lib/errors";
import { formatZmw } from "@/lib/money";
import {
  DELIVERY_METHOD_LABELS,
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_TONES,
  PRODUCT_UNIT_SHORT,
  VEHICLE_TYPE_LABELS,
} from "@/lib/labels";
import {
  AdvanceDeliveryForm,
  CompleteDeliveryForm,
  FailDeliveryDialog,
} from "./delivery-actions";

export const metadata: Metadata = {
  title: "Delivery job",
};

/**
 * One delivery job, from the driver's seat.
 *
 * Collection point, destination, both phone numbers and the load are at the top;
 * the single action that moves the job forward is right below them. Nothing else
 * competes for attention.
 */
export default async function DeliveryJobPage({
  params,
}: {
  params: Promise<{ deliveryId: string }>;
}) {
  const { deliveryId } = await params;
  const { user } = await requirePageDeliveryProvider(`/delivery/assigned/${deliveryId}`);

  const delivery = await getDeliveryDetail(deliveryId, user).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  if (!delivery.viewer.isProvider) notFound();

  const destination = [
    delivery.addressLine,
    delivery.locationDetail,
    delivery.district?.name,
    delivery.province.name,
  ]
    .filter(Boolean)
    .join(", ");

  const supplierLocation = [
    delivery.order.supplier.address,
    delivery.order.supplier.district?.name,
    delivery.order.supplier.province.name,
  ]
    .filter(Boolean)
    .join(", ");

  const nextStep = nextStepFor(delivery.status);
  const canComplete = delivery.status === "PICKED_UP" || delivery.status === "IN_TRANSIT";
  const canReportProblem = ["ACCEPTED", "PICKED_UP", "IN_TRANSIT"].includes(delivery.status);

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Order ${delivery.order.orderNumber}`}
        description={`${DELIVERY_METHOD_LABELS[delivery.method]} · ${
          delivery.feeMinor > 0 ? formatZmw(delivery.feeMinor) : "fee to agree with the supplier"
        }`}
        breadcrumbs={[
          { label: "My deliveries", href: "/delivery/assigned" },
          { label: delivery.order.orderNumber },
        ]}
        actions={
          <Badge tone={DELIVERY_STATUS_TONES[delivery.status]} size="md">
            {DELIVERY_STATUS_LABELS[delivery.status]}
          </Badge>
        }
      />

      {delivery.failureReason ? (
        <Alert tone="warning" title="Last attempt did not succeed">
          {delivery.failureReason}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle as="h2" className="text-base">
                Collect from
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <Store aria-hidden className="size-4 text-brand-700" />
                {delivery.order.supplier.businessName}
              </p>
              {supplierLocation ? (
                <p className="text-foreground-muted">{supplierLocation}</p>
              ) : null}
              <p>
                <a
                  href={`tel:${delivery.order.supplier.phone}`}
                  className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline"
                >
                  <Phone aria-hidden className="size-3.5" />
                  {delivery.order.supplier.phone}
                </a>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle as="h2" className="text-base">
                Deliver to
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="flex items-start gap-2 font-medium">
                <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-700" />
                {destination}
              </p>
              <p className="text-foreground-muted">{delivery.contactName}</p>
              <p>
                <a
                  href={`tel:${delivery.contactPhone}`}
                  className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline"
                >
                  <Phone aria-hidden className="size-3.5" />
                  {delivery.contactPhone}
                </a>
              </p>
              {delivery.instructions ? (
                <p className="mt-2 rounded-lg bg-surface-muted p-3 text-foreground-muted">
                  <span className="font-medium text-foreground">Instructions: </span>
                  {delivery.instructions}
                </p>
              ) : null}
              {delivery.scheduledFor ? (
                <p className="text-xs text-foreground-muted">
                  Scheduled for {formatTimestamp(delivery.scheduledFor)}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle as="h2" className="text-base">
                The load
              </CardTitle>
              <CardDescription>
                {delivery.vehicle
                  ? `${VEHICLE_TYPE_LABELS[delivery.vehicle.type]} · ${delivery.vehicle.registration}`
                  : "No vehicle recorded for this job yet."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border text-sm">
                {delivery.order.items.map((item) => (
                  <li key={item.id} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="flex items-start gap-2">
                      <Package aria-hidden className="mt-0.5 size-3.5 shrink-0 text-ink-400" />
                      {item.productName}
                    </span>
                    <span className="tabular shrink-0 font-medium">
                      {item.quantity} {PRODUCT_UNIT_SHORT[item.unit]}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle as="h2" className="text-base">
                Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline steps={delivery.timeline} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {nextStep ? (
            <Card>
              <CardContent className="p-5">
                <AdvanceDeliveryForm
                  deliveryId={delivery.id}
                  to={nextStep.to}
                  label={nextStep.label}
                />
              </CardContent>
            </Card>
          ) : null}

          {canComplete ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle as="h2" className="text-base">
                  Finish the job
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CompleteDeliveryForm
                  deliveryId={delivery.id}
                  proofRequired={requiresProofOfDelivery(delivery.method)}
                />
              </CardContent>
            </Card>
          ) : null}

          {canReportProblem ? (
            <Card>
              <CardContent className="p-5">
                <FailDeliveryDialog deliveryId={delivery.id} />
              </CardContent>
            </Card>
          ) : null}

          {delivery.status === "DELIVERED" ? (
            <Card>
              <CardContent className="space-y-3 p-5 text-sm">
                <p className="font-medium text-success-700">
                  Delivered{delivery.deliveredAt ? ` ${formatTimestamp(delivery.deliveredAt)}` : ""}
                </p>
                {delivery.receivedBy ? (
                  <p className="text-foreground-muted">Received by {delivery.receivedBy}</p>
                ) : null}
                {delivery.proofUrl ? (
                  <Image
                    src={delivery.proofUrl}
                    alt="Proof of delivery photograph"
                    width={480}
                    height={320}
                    className="rounded-lg border border-border object-cover"
                  />
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** The one move that makes sense from where this job is now. */
function nextStepFor(
  status: Awaited<ReturnType<typeof getDeliveryDetail>>["status"],
): { to: "PICKED_UP" | "IN_TRANSIT"; label: string } | null {
  switch (status) {
    case "ACCEPTED":
      return { to: "PICKED_UP", label: "I have collected the goods" };
    case "PICKED_UP":
      return { to: "IN_TRANSIT", label: "On my way to the site" };
    default:
      return null;
  }
}
