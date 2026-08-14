import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  FileText,
  ImageOff,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
  Truck,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Timeline, formatDate, formatTimestamp } from "@/components/ui/timeline";
import { requirePageUser } from "@/lib/auth/guards";
import { getOrderDetail } from "@/server/orders/queries";
import { getPaymentProvider, paymentEnvironmentNotice } from "@/lib/services/payments";
import { describePaymentCustody } from "@/lib/domain/payment-status";
import { NotFoundError } from "@/lib/errors";
import { formatZmw } from "@/lib/money";
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_TONES,
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_TONES,
  FULFILMENT_METHOD_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONES,
  PRODUCT_UNIT_SHORT,
  VERIFICATION_STATUS_LABELS,
} from "@/lib/labels";
import { ConfirmPaymentForms } from "@/components/orders/confirm-payment-forms";
import {
  CancelOrderDialog,
  ConfirmCompleteForm,
  PayOnlineForm,
  RecordPaymentDialog,
  SandboxSettleForms,
  VerifyPaymentForm,
} from "./order-actions";

export const metadata: Metadata = {
  title: "Order",
};

/**
 * One order, end to end.
 *
 * The page is deliberately a single narrative — where the order is, what is
 * owed, what was agreed, who is delivering — because that is the question a
 * customer actually has, and splitting it across tabs would hide the thing they
 * came to check.
 */
export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orderId } = await params;
  const query = await searchParams;
  const user = await requirePageUser(`/orders/${orderId}`);

  const order = await getOrderDetail(orderId, user).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  const provider = await getPaymentProvider().catch(() => null);
  const notice = paymentEnvironmentNotice();
  const { paymentSummary } = order;
  const canPay =
    order.viewer.isCustomer &&
    !order.isClosed &&
    paymentSummary.outstandingMinor > 0 &&
    paymentSummary.pendingMinor === 0;
  const canCancel =
    order.viewer.isCustomer &&
    ["PENDING_PAYMENT", "PAYMENT_PENDING", "CONFIRMED"].includes(order.status);
  const canComplete = order.viewer.isCustomer && order.status === "DELIVERED";
  const canReview = order.viewer.isCustomer && order.status === "COMPLETED" && !order.review;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Order ${order.orderNumber}`}
        description={
          order.placedAt
            ? `Placed ${formatDate(order.placedAt)} with ${order.supplier.businessName}.`
            : `With ${order.supplier.businessName}.`
        }
        breadcrumbs={[{ label: "My orders", href: "/orders" }, { label: order.orderNumber }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={ORDER_STATUS_TONES[order.status]} size="md">
              {ORDER_STATUS_LABELS[order.status]}
            </Badge>
            {canCancel ? (
              <CancelOrderDialog orderId={order.id} orderNumber={order.orderNumber} />
            ) : null}
          </div>
        }
      />

      {query.placed === "1" ? (
        <Alert tone="success" title="Order placed">
          {order.supplier.businessName} has been sent the agreement for this order. They accept it,
          then you pay them and record it here.
        </Alert>
      ) : null}
      {query.reviewed === "1" ? (
        <Alert tone="success" title="Thank you">
          Your review is published on {order.supplier.businessName}&apos;s profile.
        </Alert>
      ) : null}
      {order.status === "CANCELLED" && order.cancellationReason ? (
        <Alert tone="warning" title="This order was cancelled">
          {order.cancellationReason}
        </Alert>
      ) : null}
      {order.dispute ? (
        <Alert tone="danger" title="A dispute is open on this order">
          BuildLink is reviewing it. You can still see the full history below.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-base">
                Progress
              </CardTitle>
              <CardDescription>
                {FULFILMENT_METHOD_LABELS[order.fulfilmentMethod]}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Timeline steps={order.timeline} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-base">
                What you ordered
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="divide-y divide-border">
                {order.items.map((item) => (
                  <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-muted">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.productName}
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
                            href={`/marketplace/products/${item.productId}`}
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
                <Row label="Subtotal" value={formatZmw(order.subtotalMinor)} />
                <Row
                  label="Delivery"
                  value={order.deliveryFeeMinor > 0 ? formatZmw(order.deliveryFeeMinor) : "Free"}
                />
                <Row label="Order total" value={formatZmw(order.totalMinor)} strong />
              </dl>

              {order.customerNote ? (
                <p className="rounded-lg bg-surface-muted p-3 text-sm text-foreground-muted">
                  <span className="font-medium text-foreground">Your note: </span>
                  {order.customerNote}
                </p>
              ) : null}
              {order.supplierNote ? (
                <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-900">
                  <span className="font-medium">From the supplier: </span>
                  {order.supplierNote}
                </p>
              ) : null}
            </CardContent>
          </Card>

          {order.delivery ? (
            <Card>
              <CardHeader className="gap-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle as="h2" className="text-base">
                      {order.delivery.method === "CUSTOMER_PICKUP" ? "Collection" : "Delivery"}
                    </CardTitle>
                    <CardDescription>
                      {order.delivery.method === "CUSTOMER_PICKUP"
                        ? order.delivery.addressLine
                        : [
                            order.delivery.addressLine,
                            order.delivery.locationDetail,
                            order.delivery.district?.name,
                            order.delivery.province.name,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                    </CardDescription>
                  </div>
                  <Badge tone={DELIVERY_STATUS_TONES[order.delivery.status]}>
                    {DELIVERY_STATUS_LABELS[order.delivery.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Timeline steps={order.deliveryTimeline} />

                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <Detail label="Receiving" value={order.delivery.contactName} />
                  <Detail label="Contact number" value={order.delivery.contactPhone} />
                  {order.delivery.scheduledFor ? (
                    <Detail
                      label="Scheduled for"
                      value={formatTimestamp(order.delivery.scheduledFor)}
                    />
                  ) : null}
                  {order.delivery.provider ? (
                    <Detail
                      label="Transporter"
                      value={`${order.delivery.provider.businessName} · ${order.delivery.provider.phone}`}
                    />
                  ) : null}
                  {order.delivery.vehicle ? (
                    <Detail
                      label="Vehicle"
                      value={`${order.delivery.vehicle.type} · ${order.delivery.vehicle.registration}`}
                    />
                  ) : null}
                  {order.delivery.receivedBy ? (
                    <Detail label="Received by" value={order.delivery.receivedBy} />
                  ) : null}
                  {order.delivery.method === "THIRD_PARTY_DELIVERY" &&
                  order.delivery.feeMinor > 0 ? (
                    <Detail
                      label="Transport charge"
                      value={`${formatZmw(order.delivery.feeMinor)} — paid to the transporter`}
                    />
                  ) : null}
                </dl>

                {order.delivery.instructions ? (
                  <p className="text-sm text-foreground-muted">
                    <span className="font-medium text-foreground">Instructions: </span>
                    {order.delivery.instructions}
                  </p>
                ) : null}

                {order.delivery.failureReason ? (
                  <Alert tone="danger" title="Delivery could not be completed">
                    {order.delivery.failureReason}
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
                Payments
              </CardTitle>
              <CardDescription>
                Every payment recorded against this order, and what happened to it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.payments.length === 0 ? (
                <p className="text-sm text-foreground-muted">
                  No payment has been recorded yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {order.payments.map((payment) => (
                    <li
                      key={payment.id}
                      className="space-y-2 rounded-lg border border-border p-3"
                    >
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

                      {order.viewer.isCustomer &&
                      payment.status === "PENDING" &&
                      payment.providerReference &&
                      provider?.isSandbox ? (
                        <SandboxSettleForms paymentId={payment.id} />
                      ) : null}

                      {order.viewer.isCustomer &&
                      payment.status === "PENDING" &&
                      payment.providerReference &&
                      !provider?.isSandbox ? (
                        <VerifyPaymentForm paymentId={payment.id} />
                      ) : null}

                      {(order.viewer.isSupplier || order.viewer.isAdmin) &&
                      payment.status === "PENDING" &&
                      !payment.providerReference ? (
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
                <Row label="Confirmed" value={formatZmw(paymentSummary.settledMinor)} />
                {paymentSummary.pendingMinor > 0 ? (
                  <Row
                    label="Awaiting confirmation"
                    value={formatZmw(paymentSummary.pendingMinor)}
                  />
                ) : null}
                {paymentSummary.refundedMinor > 0 ? (
                  <Row label="Refunded" value={formatZmw(paymentSummary.refundedMinor)} />
                ) : null}
                <Row
                  label="Still outstanding"
                  value={formatZmw(paymentSummary.outstandingMinor)}
                  strong
                />
              </dl>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {canPay ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle as="h2" className="text-base">
                  Pay {order.supplier.businessName}
                </CardTitle>
                <CardDescription>
                  {formatZmw(paymentSummary.outstandingMinor)} outstanding.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {provider ? (
                  <PayOnlineForm
                    orderId={order.id}
                    outstandingMinor={paymentSummary.outstandingMinor}
                    providerLabel={provider.isSandbox ? "the sandbox" : provider.name}
                  />
                ) : null}
                <RecordPaymentDialog
                  orderId={order.id}
                  outstandingMinor={paymentSummary.outstandingMinor}
                />
                {notice ? (
                  <p className="text-xs text-foreground-muted">{notice.message}</p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {paymentSummary.pendingMinor > 0 && order.viewer.isCustomer ? (
            <Alert tone="info" title="A payment is awaiting confirmation">
              {order.supplier.businessName} still has to confirm the{" "}
              {formatZmw(paymentSummary.pendingMinor)} you recorded.
            </Alert>
          ) : null}

          {canComplete ? (
            <Card>
              <CardContent className="space-y-2 p-5">
                <ConfirmCompleteForm orderId={order.id} />
                <p className="text-xs text-foreground-muted">
                  Only confirm once you have checked the quantities and quality on site.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {canReview ? (
            <Card>
              <CardContent className="space-y-2 p-5">
                <Button asChild block variant="accent">
                  <Link href={`/orders/${order.id}/review`}>
                    <Star aria-hidden />
                    Review {order.supplier.businessName}
                  </Link>
                </Button>
                <p className="text-xs text-foreground-muted">
                  Your review helps the next person building a house choose well.
                </p>
              </CardContent>
            </Card>
          ) : null}

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
                <Button asChild variant="outline" block>
                  <Link href={`/agreements/${order.contract.id}`}>
                    <FileText aria-hidden />
                    Read the agreement
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle as="h2" className="text-base">
                Supplier
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">
                <Link
                  href={`/marketplace/suppliers/${order.supplier.slug}`}
                  className="hover:text-brand-700 hover:underline"
                >
                  {order.supplier.businessName}
                </Link>
              </p>
              <p className="flex items-center gap-1.5 text-xs text-foreground-muted">
                <ShieldCheck aria-hidden className="size-3.5" />
                {VERIFICATION_STATUS_LABELS[order.supplier.verificationStatus]}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-foreground-muted">
                <MapPin aria-hidden className="size-3.5" />
                {order.supplier.district?.name
                  ? `${order.supplier.district.name}, ${order.supplier.province.name}`
                  : order.supplier.province.name}
              </p>
              {order.status !== "PENDING_PAYMENT" ? (
                <p className="flex items-center gap-1.5 text-xs text-foreground-muted">
                  <Phone aria-hidden className="size-3.5" />
                  <a href={`tel:${order.supplier.phone}`} className="hover:underline">
                    {order.supplier.phone}
                  </a>
                </p>
              ) : null}
              {order.supplier.isDemo ? (
                <Badge tone="neutral" size="sm">
                  Demo supplier
                </Badge>
              ) : null}
            </CardContent>
          </Card>

          {order.project ? (
            <Card>
              <CardContent className="space-y-2 p-5 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">
                  Project
                </p>
                <Link
                  href={`/customer/projects/${order.project.id}`}
                  className="font-medium hover:text-brand-700 hover:underline"
                >
                  {order.project.name}
                </Link>
                <p className="text-xs text-foreground-muted">
                  This order&apos;s {formatZmw(order.totalMinor)} is recorded against that
                  project&apos;s budget and wallet.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {order.fulfilmentMethod === "THIRD_PARTY_DELIVERY" ? (
            <Alert tone="info" title="Transport is quoted separately">
              <span className="flex items-start gap-1.5">
                <Truck aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                A transporter will be assigned and their fee added to the delivery once the supplier
                has your materials ready.
              </span>
            </Alert>
          ) : null}
        </div>
      </div>
    </div>
  );
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
