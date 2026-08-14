import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileCheck2, Phone, Truck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { formatTimestamp } from "@/components/ui/timeline";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrapper,
} from "@/components/ui/table";
import { requirePageAdmin } from "@/lib/auth/guards";
import { getDisputeForAdmin } from "@/server/admin/queries";
import { NotFoundError } from "@/lib/errors";
import { formatZmw } from "@/lib/money";
import {
  DELIVERY_METHOD_LABELS,
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_TONES,
  DISPUTE_REASON_LABELS,
  DISPUTE_STATUS_LABELS,
  DISPUTE_STATUS_TONES,
  FULFILMENT_METHOD_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONES,
  PRODUCT_UNIT_SHORT,
  USER_ROLE_LABELS,
  VERIFICATION_STATUS_LABELS,
} from "@/lib/labels";
import { AcknowledgeDisputeForm, DecideDisputeDialog } from "./dispute-actions";
import type { ProductUnit } from "@prisma/client";

export const metadata: Metadata = {
  title: "Dispute",
  description: "Both sides of an escalated order, and the decision.",
};

/**
 * One dispute, with the evidence.
 *
 * An administrator deciding this needs three things on one screen: what the
 * complaint says, what the order record actually shows, and who to ring. So the
 * page puts the complaint first, then the payment and delivery record beside it
 * — because "they say they paid" and "the supplier confirmed the money arrived"
 * are different facts, and this is where the difference gets settled.
 */
export default async function AdminDisputePage({
  params,
}: {
  params: Promise<{ disputeId: string }>;
}) {
  await requirePageAdmin("/admin/disputes");
  const { disputeId } = await params;

  const dispute = await getDisputeForAdmin(disputeId).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  const { order } = dispute;
  const decided = dispute.status === "RESOLVED" || dispute.status === "CLOSED";
  const confirmedPaid = order.payments
    .filter((payment) => payment.status === "SUCCESSFUL")
    .reduce((total, payment) => total + payment.amountMinor, 0);

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/disputes">
          <ArrowLeft aria-hidden />
          All disputes
        </Link>
      </Button>

      <PageHeader
        title={`Dispute on ${order.orderNumber}`}
        description={`${DISPUTE_REASON_LABELS[dispute.reason]} · raised ${formatTimestamp(dispute.createdAt)} by ${dispute.raisedBy.name}.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/orders/${order.id}`}>
                <ExternalLink aria-hidden />
                Order record
              </Link>
            </Button>
            {decided ? null : (
              <>
                <DecideDisputeDialog
                  disputeId={dispute.id}
                  orderNumber={order.orderNumber}
                  outcome="RESOLVED"
                />
                <DecideDisputeDialog
                  disputeId={dispute.id}
                  orderNumber={order.orderNumber}
                  outcome="CLOSED"
                />
              </>
            )}
          </div>
        }
      >
        <Badge tone={DISPUTE_STATUS_TONES[dispute.status]}>
          {DISPUTE_STATUS_LABELS[dispute.status]}
        </Badge>
      </PageHeader>

      {decided ? (
        <Alert
          tone={dispute.status === "RESOLVED" ? "success" : "info"}
          title={`${DISPUTE_STATUS_LABELS[dispute.status]}${dispute.resolvedBy ? ` by ${dispute.resolvedBy.name}` : ""}${dispute.resolvedAt ? ` on ${formatTimestamp(dispute.resolvedAt)}` : ""}`}
        >
          {dispute.resolution ?? "No decision text was recorded."}
        </Alert>
      ) : dispute.status === "OPEN" ? (
        <Alert tone="warning" title="Nobody has acknowledged this yet">
          <div className="space-y-3">
            <p>
              Marking it under review tells both the customer and the supplier that BuildLink has
              seen it. Do that first, then gather the facts below.
            </p>
            <AcknowledgeDisputeForm disputeId={dispute.id} />
          </div>
        </Alert>
      ) : (
        <Alert tone="info" title="Under review">
          Both parties have been told BuildLink is looking into this. Record a decision once you
          have spoken to them.
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>What was reported</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm font-medium text-foreground">
                {DISPUTE_REASON_LABELS[dispute.reason]}
              </p>
              <p className="whitespace-pre-line text-sm text-foreground-muted">
                {dispute.description}
              </p>
              <p className="text-xs text-foreground-subtle">
                {dispute.raisedBy.name} ({USER_ROLE_LABELS[dispute.raisedBy.role]}) ·{" "}
                {formatTimestamp(dispute.createdAt)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What was ordered</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <TableWrapper label={`Items on order ${order.orderNumber}`}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead numeric>Quantity</TableHead>
                      <TableHead numeric>Line total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm">{item.productName}</TableCell>
                        <TableCell numeric>
                          {item.quantity} {PRODUCT_UNIT_SHORT[item.unit as ProductUnit]}
                        </TableCell>
                        <TableCell numeric>{formatZmw(item.lineTotalMinor)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrapper>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm">
                <span className="text-foreground-muted">
                  {ORDER_STATUS_LABELS[order.status]} ·{" "}
                  {FULFILMENT_METHOD_LABELS[order.fulfilmentMethod]}
                  {order.placedAt ? ` · placed ${formatTimestamp(order.placedAt)}` : null}
                </span>
                <span className="font-semibold text-foreground">
                  {formatZmw(order.totalMinor)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What was paid</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.payments.length === 0 ? (
                <p className="text-sm text-foreground-muted">
                  No payment has been recorded against this order at all.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {order.payments.map((payment) => (
                    <li
                      key={payment.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{payment.reference}</p>
                        <p className="text-xs text-foreground-muted">
                          {PAYMENT_METHOD_LABELS[payment.method]} ·{" "}
                          {formatTimestamp(payment.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={PAYMENT_STATUS_TONES[payment.status]} size="sm">
                          {PAYMENT_STATUS_LABELS[payment.status]}
                        </Badge>
                        <span className="text-sm font-semibold text-foreground">
                          {formatZmw(payment.amountMinor)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-foreground-subtle">
                {formatZmw(confirmedPaid)} of {formatZmw(order.totalMinor)} confirmed received by
                the supplier. BuildLink never held any of this money, so a confirmation here means
                the supplier said the funds reached them.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What was delivered</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.delivery ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={DELIVERY_STATUS_TONES[order.delivery.status]} size="sm">
                      {DELIVERY_STATUS_LABELS[order.delivery.status]}
                    </Badge>
                    <span className="inline-flex items-center gap-1 text-sm text-foreground-muted">
                      <Truck className="size-4" aria-hidden />
                      {DELIVERY_METHOD_LABELS[order.delivery.method]}
                    </span>
                  </div>
                  {order.delivery.deliveredAt ? (
                    <p className="text-sm text-foreground-muted">
                      Marked delivered {formatTimestamp(order.delivery.deliveredAt)}
                      {order.delivery.receivedBy ? `, received by ${order.delivery.receivedBy}` : ""}
                      .
                    </p>
                  ) : null}
                  {order.delivery.failureReason ? (
                    <p className="text-sm text-danger-700">
                      Failed: {order.delivery.failureReason}
                    </p>
                  ) : null}
                  {dispute.proofUrl ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={dispute.proofUrl} target="_blank" rel="noreferrer">
                        <FileCheck2 aria-hidden />
                        Proof of delivery
                      </Link>
                    </Button>
                  ) : (
                    <p className="text-xs text-foreground-subtle">
                      No proof of delivery was uploaded, so there is no photo or signature to check
                      the claim against.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-foreground-muted">
                  This order has no delivery record — it was collected, or delivery was never
                  arranged.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>The customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium text-foreground">{order.customer.name}</p>
              <p className="text-foreground-muted">{order.customer.email}</p>
              {order.customer.phone ? (
                <a
                  href={`tel:${order.customer.phone}`}
                  className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
                >
                  <Phone className="size-4" aria-hidden />
                  {order.customer.phone}
                </a>
              ) : null}
              <Button asChild variant="ghost" size="sm" className="-ml-2">
                <Link href={`/admin/users/${order.customer.id}`}>Open account</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>The supplier</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium text-foreground">{dispute.supplier.businessName}</p>
              <p className="text-foreground-muted">
                {VERIFICATION_STATUS_LABELS[dispute.supplier.verificationStatus]} · contact{" "}
                {dispute.supplier.user.name}
              </p>
              <p className="text-foreground-muted">{dispute.supplier.email}</p>
              <a
                href={`tel:${dispute.supplier.phone}`}
                className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
              >
                <Phone className="size-4" aria-hidden />
                {dispute.supplier.phone}
              </a>
              <Button asChild variant="ghost" size="sm" className="-ml-2">
                <Link href={`/admin/suppliers/${dispute.supplier.id}`}>
                  Open business record
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What BuildLink can do</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-foreground-muted">
              <p>
                Record what was ordered, paid and delivered, and publish a decision both parties can
                see.
              </p>
              <p>
                Suspend a business whose pattern of disputes shows it is failing customers. That is
                on the business record.
              </p>
              <p>
                BuildLink cannot recover or refund money, because payments go directly between
                customer and supplier.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
