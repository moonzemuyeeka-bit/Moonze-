import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { FileText, ImageOff, MapPin, Phone, Truck, User } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Timeline, formatDate, formatTimestamp } from "@/components/ui/timeline";
import { ConfirmPaymentForms } from "@/components/orders/confirm-payment-forms";
import { requirePageSupplier } from "@/lib/auth/guards";
import { getOrderDetail } from "@/server/orders/queries";
import { listProvidersForDelivery } from "@/server/delivery/queries";
import { db } from "@/lib/db";
import { nextSupplierAction } from "@/lib/domain/order-status";
import { describePaymentCustody } from "@/lib/domain/payment-status";
import { NotFoundError } from "@/lib/errors";
import { formatZmw } from "@/lib/money";
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_TONES,
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_TONES,
  FULFILMENT_METHOD_LABELS,
  ORDER_STATUS_LABELS_SUPPLIER,
  ORDER_STATUS_TONES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONES,
  PRODUCT_UNIT_SHORT,
} from "@/lib/labels";
import {
  AdvanceOrderForm,
  AssignTransporterDialog,
  FailDeliveryDialog,
  RecordDeliveryDialog,
  SupplierCancelOrderDialog,
  type TransporterOption,
} from "./supplier-order-actions";

export const metadata: Metadata = {
  title: "Order",
};

/**
 * One order, from the supplier's side.
 *
 * Everything that needs doing is in the right-hand column in the order it has to
 * happen: confirm, prepare, get it there, take the money. The left-hand column is
 * the record — what was ordered, where it goes, what has been paid.
 */
export default async function SupplierOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const { user, supplier } = await requirePageSupplier(`/supplier/orders/${orderId}`);

  const order = await getOrderDetail(orderId, user).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  if (order.supplierId !== supplier.id) notFound();

  const { paymentSummary, delivery } = order;
  const nextAction = nextSupplierAction(order.status, order.fulfilmentMethod);
  const isCollection = order.fulfilmentMethod === "CUSTOMER_PICKUP";
  const isThirdParty = order.fulfilmentMethod === "THIRD_PARTY_DELIVERY";

  // Signing for goods is a delivery record, not a status dropdown, so the
  // "delivered" step is handed to the delivery form when one exists.
  const completesDelivery = nextAction?.to === "DELIVERED" && delivery !== null;
  const canAssignTransporter =
    isThirdParty &&
    delivery !== null &&
    delivery.provider === null &&
    ["REQUESTED", "ASSIGNED"].includes(delivery.status) &&
    ["CONFIRMED", "PROCESSING", "READY_FOR_DELIVERY"].includes(order.status);

  const transporters: TransporterOption[] = canAssignTransporter
    ? await loadTransporters(delivery.id)
    : [];

  const canCancel = ["PENDING_PAYMENT", "PAYMENT_PENDING", "CONFIRMED", "PROCESSING"].includes(
    order.status,
  );
  const canFailDelivery =
    delivery !== null && ["PICKED_UP", "IN_TRANSIT"].includes(delivery.status) && !isThirdParty;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Order ${order.orderNumber}`}
        description={
          order.placedAt
            ? `Placed ${formatDate(order.placedAt)} by ${order.customer.name}.`
            : `From ${order.customer.name}.`
        }
        breadcrumbs={[{ label: "Orders", href: "/supplier/orders" }, { label: order.orderNumber }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={ORDER_STATUS_TONES[order.status]} size="md">
              {ORDER_STATUS_LABELS_SUPPLIER[order.status]}
            </Badge>
            {canCancel ? (
              <SupplierCancelOrderDialog orderId={order.id} orderNumber={order.orderNumber} />
            ) : null}
          </div>
        }
      />

      {order.status === "PENDING_PAYMENT" || order.status === "PAYMENT_PENDING" ? (
        <Alert tone="warning" title="This customer is waiting to hear from you">
          Confirming tells them you have the stock and will supply it. You do not have to wait for
          the money first — most customers pay once they know the order is real.
        </Alert>
      ) : null}

      {order.status === "CANCELLED" && order.cancellationReason ? (
        <Alert tone="warning" title="This order was cancelled">
          {order.cancellationReason}
        </Alert>
      ) : null}

      {order.dispute ? (
        <Alert tone="danger" title="A dispute is open on this order">
          BuildLink is reviewing it and will contact you. Keep any delivery notes and photographs.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-base">
                What to supply
              </CardTitle>
              <CardDescription>
                {FULFILMENT_METHOD_LABELS[order.fulfilmentMethod]}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="divide-y divide-border">
                {order.items.map((item) => (
                  <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-muted">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt=""
                          fill
                          sizes="3.5rem"
                          className="object-cover"
                        />
                      ) : (
                        <span className="flex size-full items-center justify-center text-ink-300">
                          <ImageOff aria-hidden className="size-4" />
                        </span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {item.productId ? (
                          <Link
                            href={`/supplier/products/${item.productId}`}
                            className="hover:text-brand-700 hover:underline"
                          >
                            {item.productName}
                          </Link>
                        ) : (
                          item.productName
                        )}
                      </p>
                      <p className="text-xs text-foreground-muted">
                        {item.quantity} × {formatZmw(item.unitPriceMinor)} /{" "}
                        {PRODUCT_UNIT_SHORT[item.unit]}
                        {item.brand ? ` · ${item.brand}` : ""}
                      </p>
                    </div>
                    <p className="tabular shrink-0 text-sm font-semibold">
                      {formatZmw(item.lineTotalMinor)}
                    </p>
                  </li>
                ))}
              </ul>

              <dl className="space-y-1 border-t border-border pt-3 text-sm">
                <Row label="Goods" value={formatZmw(order.subtotalMinor)} />
                <Row
                  label={isThirdParty ? "Transport (paid to the transporter)" : "Delivery"}
                  value={order.deliveryFeeMinor > 0 ? formatZmw(order.deliveryFeeMinor) : "Free"}
                />
                {order.commissionMinor > 0 ? (
                  <Row
                    label={`BuildLink commission (${(order.commissionRateBps / 100).toFixed(1)}%)`}
                    value={`− ${formatZmw(order.commissionMinor)}`}
                  />
                ) : null}
                <Row label="Order total" value={formatZmw(order.totalMinor)} strong />
                {order.commissionMinor > 0 ? (
                  <Row
                    label="Your net"
                    value={formatZmw(order.totalMinor - order.commissionMinor)}
                    strong
                  />
                ) : null}
              </dl>

              {order.customerNote ? (
                <p className="rounded-lg bg-surface-muted p-3 text-sm text-foreground-muted">
                  <span className="font-medium text-foreground">From the customer: </span>
                  {order.customerNote}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-base">
                Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline steps={order.timeline} />
            </CardContent>
          </Card>

          {delivery ? (
            <Card>
              <CardHeader className="gap-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle as="h2" className="text-base">
                      {isCollection ? "Collection" : "Delivery"}
                    </CardTitle>
                    <CardDescription>
                      {isCollection
                        ? delivery.addressLine
                        : [
                            delivery.addressLine,
                            delivery.locationDetail,
                            delivery.district?.name,
                            delivery.province.name,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                    </CardDescription>
                  </div>
                  <Badge tone={DELIVERY_STATUS_TONES[delivery.status]}>
                    {DELIVERY_STATUS_LABELS[delivery.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Timeline steps={order.deliveryTimeline} />

                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <Detail label="Receiving" value={delivery.contactName} />
                  <Detail label="Contact number" value={delivery.contactPhone} />
                  {delivery.scheduledFor ? (
                    <Detail label="Scheduled" value={formatTimestamp(delivery.scheduledFor)} />
                  ) : null}
                  {delivery.provider ? (
                    <Detail
                      label="Transporter"
                      value={`${delivery.provider.businessName} · ${delivery.provider.phone}`}
                    />
                  ) : null}
                  {delivery.vehicle ? (
                    <Detail
                      label="Vehicle"
                      value={`${delivery.vehicle.type} · ${delivery.vehicle.registration}`}
                    />
                  ) : null}
                  {delivery.receivedBy ? (
                    <Detail label="Received by" value={delivery.receivedBy} />
                  ) : null}
                </dl>

                {delivery.instructions ? (
                  <p className="text-sm text-foreground-muted">
                    <span className="font-medium text-foreground">Instructions: </span>
                    {delivery.instructions}
                  </p>
                ) : null}

                {delivery.failureReason ? (
                  <Alert tone="danger" title="A delivery attempt failed">
                    {delivery.failureReason}
                  </Alert>
                ) : null}

                {order.proofUrl ? (
                  <figure className="space-y-1">
                    <figcaption className="text-xs font-medium text-foreground-subtle">
                      Proof of delivery
                    </figcaption>
                    <Image
                      src={order.proofUrl}
                      alt="Proof of delivery photograph"
                      width={480}
                      height={320}
                      className="rounded-lg border border-border object-cover"
                    />
                  </figure>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-base">
                Money
              </CardTitle>
              <CardDescription>
                Payments are made directly to you. BuildLink keeps the record, not the money.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.payments.length === 0 ? (
                <p className="text-sm text-foreground-muted">
                  The customer has not recorded a payment yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {order.payments.map((payment) => (
                    <li key={payment.id} className="space-y-2 rounded-lg border border-border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">
                            {formatZmw(payment.amountMinor)}
                            <span className="ml-2 font-normal text-foreground-muted">
                              {PAYMENT_METHOD_LABELS[payment.method]}
                            </span>
                          </p>
                          <p className="text-xs text-foreground-muted">
                            {payment.reference} · {formatTimestamp(payment.createdAt)}
                          </p>
                        </div>
                        <Badge tone={PAYMENT_STATUS_TONES[payment.status]} size="sm">
                          {PAYMENT_STATUS_LABELS[payment.status]}
                        </Badge>
                      </div>

                      <p className="text-xs text-foreground-muted">
                        {describePaymentCustody(payment.method)}
                      </p>

                      {payment.failureReason ? (
                        <p className="text-xs text-danger-700">{payment.failureReason}</p>
                      ) : null}

                      {payment.status === "PENDING" && !payment.providerReference ? (
                        <ConfirmPaymentForms
                          paymentId={payment.id}
                          amountMinor={payment.amountMinor}
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              <dl className="space-y-1 border-t border-border pt-3 text-sm">
                <Row label="Confirmed received" value={formatZmw(paymentSummary.settledMinor)} />
                {paymentSummary.pendingMinor > 0 ? (
                  <Row
                    label="Waiting on your confirmation"
                    value={formatZmw(paymentSummary.pendingMinor)}
                  />
                ) : null}
                <Row label="Still owed" value={formatZmw(paymentSummary.outstandingMinor)} strong />
              </dl>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {nextAction || canAssignTransporter ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle as="h2" className="text-base">
                  What happens next
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {completesDelivery && delivery ? (
                  <RecordDeliveryDialog
                    deliveryId={delivery.id}
                    isCollection={isCollection}
                    contactName={delivery.contactName}
                  />
                ) : nextAction && !(isThirdParty && nextAction.to === "OUT_FOR_DELIVERY") ? (
                  <AdvanceOrderForm
                    orderId={order.id}
                    to={nextAction.to}
                    label={nextAction.label}
                  />
                ) : null}

                {canAssignTransporter && delivery ? (
                  <AssignTransporterDialog
                    deliveryId={delivery.id}
                    transporters={transporters}
                    currentFeeMinor={delivery.feeMinor}
                  />
                ) : null}

                {isThirdParty && delivery?.provider === null ? (
                  <p className="flex items-start gap-1.5 text-xs text-foreground-muted">
                    <Truck aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                    This job is on the transporter board once the order is confirmed. A transporter
                    covering {delivery.district?.name ?? delivery.province.name} can claim it, or
                    you can assign one yourself.
                  </p>
                ) : null}

                {canFailDelivery && delivery ? <FailDeliveryDialog deliveryId={delivery.id} /> : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle as="h2" className="text-base">
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="flex items-center gap-1.5 font-medium">
                <User aria-hidden className="size-3.5 text-foreground-muted" />
                {order.customer.name}
              </p>
              {order.status === "PENDING_PAYMENT" ? (
                <p className="text-xs text-foreground-muted">
                  Contact details appear once you have confirmed the order.
                </p>
              ) : (
                <>
                  {order.customer.phone ? (
                    <p className="flex items-center gap-1.5 text-xs text-foreground-muted">
                      <Phone aria-hidden className="size-3.5" />
                      <a href={`tel:${order.customer.phone}`} className="hover:underline">
                        {order.customer.phone}
                      </a>
                    </p>
                  ) : null}
                  {delivery ? (
                    <p className="flex items-start gap-1.5 text-xs text-foreground-muted">
                      <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                      {[delivery.district?.name, delivery.province.name]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>

          {order.contract ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle as="h2" className="text-base">
                  Agreement
                </CardTitle>
                <CardDescription>{order.contract.contractNumber}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge tone={CONTRACT_STATUS_TONES[order.contract.status]}>
                  {CONTRACT_STATUS_LABELS[order.contract.status]}
                </Badge>
                {order.contract.status === "SENT" && order.contract.createdByRole === "CUSTOMER" ? (
                  <p className="text-xs text-gold-800">
                    This customer is waiting for you to accept the agreement.
                  </p>
                ) : null}
                <Button asChild variant="outline" block>
                  <Link href={`/agreements/${order.contract.id}`}>
                    <FileText aria-hidden />
                    Read the agreement
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {order.review ? (
            <Card>
              <CardContent className="space-y-1 p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">
                  Customer review
                </p>
                <p className="text-sm font-semibold">{order.review.rating} out of 5</p>
                {order.review.comment ? (
                  <p className="text-sm text-foreground-muted">“{order.review.comment}”</p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Transporters who cover this delivery's destination, each with the fee they
 * publish for it so the supplier can compare before assigning.
 */
async function loadTransporters(deliveryId: string): Promise<TransporterOption[]> {
  const delivery = await db.delivery.findUnique({
    where: { id: deliveryId },
    select: { provinceId: true, districtId: true },
  });
  if (!delivery) return [];

  const providers = await listProvidersForDelivery({
    provinceId: delivery.provinceId,
    districtId: delivery.districtId,
  });

  return providers.map((provider) => {
    const exact = provider.serviceAreas.find((area) => area.districtId === delivery.districtId);
    const province = provider.serviceAreas.find((area) => area.districtId === null);
    return {
      id: provider.id,
      businessName: provider.businessName,
      type: provider.type,
      phone: provider.phone,
      quotedFeeMinor: (exact ?? province)?.feeMinor ?? null,
      completedDeliveries: provider.completedDeliveries,
      isDemo: provider.isDemo,
      vehicles: provider.vehicles,
    };
  });
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={strong ? "font-semibold" : "text-foreground-muted"}>{label}</dt>
      <dd className={strong ? "tabular font-semibold" : "tabular"}>{value}</dd>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}
