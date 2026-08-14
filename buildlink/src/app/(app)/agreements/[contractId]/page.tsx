import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, MapPin, Receipt, ScrollText, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrapper,
} from "@/components/ui/table";
import { formatDate, formatTimestamp } from "@/components/ui/timeline";
import { requirePageUser } from "@/lib/auth/guards";
import { getContractDetail } from "@/server/contracts/queries";
import { CONTRACT_LEGAL_NOTICE } from "@/lib/domain/contract-status";
import { NotFoundError } from "@/lib/errors";
import { formatZmw } from "@/lib/money";
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_TONES,
  FULFILMENT_METHOD_LABELS,
  PRODUCT_UNIT_SHORT,
} from "@/lib/labels";
import {
  CancelAgreementDialog,
  RespondToAgreementForms,
  SendAgreementForm,
} from "./agreement-actions";

export const metadata: Metadata = {
  title: "Agreement",
};

/**
 * One agreement, readable end to end before anyone signs it.
 *
 * Everything a party is agreeing to is on this page — items, prices, deposit,
 * balance, delivery, terms, cancellation terms — followed by the acceptance
 * record. Nothing is behind a tab or a "show more", because you cannot
 * meaningfully accept what you have not been shown.
 */
export default async function AgreementPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = await params;
  const user = await requirePageUser(`/agreements/${contractId}`);

  const agreement = await getContractDetail(contractId, user).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  const counterpartyLabel =
    agreement.viewer.role === "CUSTOMER" ? agreement.supplier.businessName : agreement.customer.name;
  const backHref =
    agreement.viewer.role === "SUPPLIER" ? "/supplier/contracts" : "/customer/contracts";
  const canCancel =
    agreement.viewer.role !== null &&
    (agreement.status === "DRAFT" || agreement.status === "SENT" || agreement.status === "ACCEPTED");

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Agreement ${agreement.contractNumber}`}
        description={`Between ${agreement.customer.name} and ${agreement.supplier.businessName}${
          agreement.order ? ` for order ${agreement.order.orderNumber}` : ""
        }.`}
        breadcrumbs={[{ label: "Agreements", href: backHref }, { label: agreement.contractNumber }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={CONTRACT_STATUS_TONES[agreement.status]} size="md">
              {CONTRACT_STATUS_LABELS[agreement.status]}
            </Badge>
            {canCancel ? (
              <CancelAgreementDialog
                contractId={agreement.id}
                contractNumber={agreement.contractNumber}
              />
            ) : null}
          </div>
        }
      />

      {agreement.status === "SENT" && agreement.viewer.canRespond ? (
        <Alert tone="warning" title="This agreement is waiting for you">
          Read it through, then accept or reject it below. Accepting records your name against
          version {agreement.version} of this agreement.
        </Alert>
      ) : null}
      {agreement.status === "SENT" && !agreement.viewer.canRespond ? (
        <Alert tone="info" title={`Waiting for ${counterpartyLabel}`}>
          They have been notified and can accept or reject it.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-base">
                Parties
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Party
                heading="Customer"
                name={agreement.customer.name}
                lines={[agreement.customer.phone ?? "", agreement.customer.email]}
              />
              <Party
                heading="Supplier"
                name={agreement.supplier.businessName}
                href={`/marketplace/suppliers/${agreement.supplier.slug}`}
                lines={[
                  agreement.supplier.phone,
                  agreement.supplier.address ?? "",
                  agreement.supplier.district?.name
                    ? `${agreement.supplier.district.name}, ${agreement.supplier.province.name}`
                    : agreement.supplier.province.name,
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-base">
                What is being supplied
              </CardTitle>
              <CardDescription>
                Version {agreement.version} · drawn up {formatDate(agreement.createdAt)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <TableWrapper label={`Items on agreement ${agreement.contractNumber}`}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead numeric>Quantity</TableHead>
                      <TableHead numeric>Unit price</TableHead>
                      <TableHead numeric>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agreement.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell numeric>
                          {item.quantity} {PRODUCT_UNIT_SHORT[item.unit]}
                        </TableCell>
                        <TableCell numeric>{formatZmw(item.unitPriceMinor)}</TableCell>
                        <TableCell numeric>{formatZmw(item.lineTotalMinor)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrapper>

              <dl className="space-y-1 text-sm">
                <Row label="Subtotal" value={formatZmw(agreement.subtotalMinor)} />
                <Row
                  label="Delivery"
                  value={
                    agreement.deliveryFeeMinor > 0
                      ? formatZmw(agreement.deliveryFeeMinor)
                      : "Free"
                  }
                />
                <Row label="Total" value={formatZmw(agreement.totalMinor)} strong />
              </dl>

              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Detail
                  label="Deposit"
                  value={
                    agreement.depositMinor > 0
                      ? formatZmw(agreement.depositMinor)
                      : "No deposit required"
                  }
                />
                <Detail label="Balance" value={formatZmw(agreement.balanceMinor)} />
                <Detail
                  label="Delivery date"
                  value={
                    agreement.deliveryDate
                      ? formatDate(agreement.deliveryDate)
                      : "To be agreed between the parties"
                  }
                />
                <Detail
                  label="Delivery"
                  value={
                    agreement.order
                      ? FULFILMENT_METHOD_LABELS[agreement.order.fulfilmentMethod]
                      : "As agreed"
                  }
                />
              </dl>

              {agreement.deliveryLocation ? (
                <p className="flex items-start gap-2 text-sm text-foreground-muted">
                  <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />
                  <span>
                    <span className="font-medium text-foreground">Delivery to: </span>
                    {agreement.deliveryLocation}
                  </span>
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-base">
                Terms
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 text-sm">
              <TermsList heading="Supply terms" text={agreement.terms} />
              {agreement.cancellationTerms ? (
                <TermsList heading="Cancellation" text={agreement.cancellationTerms} />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-base">
                Acceptance record
              </CardTitle>
              <CardDescription>
                Every decision is stored with the agreement version it applied to, so an amended
                agreement can never inherit an earlier signature.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {agreement.acceptances.length === 0 ? (
                <p className="text-sm text-foreground-muted">
                  Nobody has accepted or rejected this agreement yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {agreement.acceptances.map((acceptance) => (
                    <li
                      key={acceptance.id}
                      className="rounded-lg border border-border p-3 text-sm"
                    >
                      <p className="font-medium">
                        {acceptance.signatureName}
                        <span className="ml-2 font-normal text-foreground-muted">
                          {acceptance.role === "CUSTOMER" ? "Customer" : "Supplier"}
                        </span>
                      </p>
                      <p className="text-xs text-foreground-muted">
                        {acceptance.accepted ? "Accepted" : "Rejected"} version{" "}
                        {acceptance.contractVersion} on {formatTimestamp(acceptance.acceptedAt)}
                        {acceptance.ipAddress ? ` · from ${acceptance.ipAddress}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {agreement.viewer.canRespond ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle as="h2" className="text-base">
                  Your decision
                </CardTitle>
                <CardDescription>
                  {formatZmw(agreement.totalMinor)} from {counterpartyLabel}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RespondToAgreementForms
                  contractId={agreement.id}
                  contractNumber={agreement.contractNumber}
                  suggestedName={user.name}
                  totalLabel={formatZmw(agreement.totalMinor)}
                  counterpartyLabel={counterpartyLabel}
                />
              </CardContent>
            </Card>
          ) : null}

          {agreement.viewer.canSend ? (
            <Card>
              <CardContent className="space-y-2 p-5">
                <SendAgreementForm contractId={agreement.id} />
                <p className="text-xs text-foreground-muted">
                  {counterpartyLabel} is notified and can then accept or reject it.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {agreement.order ? (
            <Card>
              <CardContent className="space-y-3 p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">
                  Order
                </p>
                <Button asChild variant="outline" block>
                  <Link
                    href={
                      agreement.viewer.role === "SUPPLIER"
                        ? `/supplier/orders/${agreement.order.id}`
                        : `/orders/${agreement.order.id}`
                    }
                  >
                    <Receipt aria-hidden />
                    {agreement.order.orderNumber}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {agreement.project ? (
            <Card>
              <CardContent className="space-y-2 p-5 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">
                  Project
                </p>
                <Link
                  href={`/customer/projects/${agreement.project.id}`}
                  className="font-medium hover:text-brand-700 hover:underline"
                >
                  {agreement.project.name}
                </Link>
              </CardContent>
            </Card>
          ) : null}

          <Alert tone="warning" title="Not legal advice">
            <span className="flex items-start gap-2">
              <ShieldAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              {agreement.notes ?? CONTRACT_LEGAL_NOTICE}
            </span>
          </Alert>

          <p className="flex items-start gap-2 text-xs text-foreground-muted">
            <FileText aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            Print this page to keep a paper copy. Both parties see the same agreement and the same
            acceptance record.
          </p>
        </div>
      </div>
    </div>
  );
}

function Party({
  heading,
  name,
  href,
  lines,
}: {
  heading: string;
  name: string;
  href?: string;
  lines: string[];
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">
        {heading}
      </p>
      <p className="font-medium">
        {href ? (
          <Link href={href} className="hover:text-brand-700 hover:underline">
            {name}
          </Link>
        ) : (
          name
        )}
      </p>
      {lines
        .filter((line) => line.trim() !== "")
        .map((line) => (
          <p key={line} className="text-xs text-foreground-muted">
            {line}
          </p>
        ))}
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

function TermsList({ heading, text }: { heading: string; text: string }) {
  const clauses = text.split("\n").filter((clause) => clause.trim() !== "");
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <ScrollText aria-hidden className="size-4 text-brand-700" />
        {heading}
      </h3>
      <ol className="list-decimal space-y-1.5 pl-5 text-foreground-muted">
        {clauses.map((clause) => (
          <li key={clause}>{clause}</li>
        ))}
      </ol>
    </div>
  );
}
