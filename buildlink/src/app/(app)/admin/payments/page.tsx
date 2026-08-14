import type { Metadata } from "next";
import Link from "next/link";
import { Receipt, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/feedback";
import { Pagination, parsePage } from "@/components/ui/pagination";
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
import { ADMIN_PAGE_SIZE, listPaymentsForAdmin } from "@/server/admin/queries";
import { formatZmw } from "@/lib/money";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONES,
  isRecordedPaymentMethod,
} from "@/lib/labels";
import type { PaymentMethod, PaymentStatus } from "@prisma/client";

export const metadata: Metadata = {
  title: "Payments",
  description: "Every payment recorded between customers and suppliers.",
};

const FILTERS = [
  { key: "PENDING", label: "Awaiting confirmation" },
  { key: "SUCCESSFUL", label: "Confirmed" },
  { key: "FAILED", label: "Failed" },
  { key: "REFUNDED", label: "Refunded" },
  { key: "", label: "All payments" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function asFilter(value: string | undefined): FilterKey {
  const match = FILTERS.find((filter) => filter.key === value);
  return match ? match.key : "PENDING";
}

/**
 * The payment ledger.
 *
 * BuildLink never held any of this money, so this screen is a record rather than
 * a treasury: it exists so support can answer "the customer says they paid" with
 * the reference, the method and who confirmed it. There is deliberately no
 * administrative "mark as paid" — only the supplier who received the money can
 * confirm it.
 */
export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageAdmin("/admin/payments");
  const params = await searchParams;

  const filter = asFilter(typeof params.status === "string" ? params.status : undefined);
  const search = typeof params.q === "string" ? params.q.trim() : "";
  const page = parsePage(params.page);

  const { payments, total, pageCount, totals } = await listPaymentsForAdmin({
    status: filter === "" ? undefined : (filter as PaymentStatus),
    search: search || undefined,
    page,
  });

  function hrefFor(next: { status?: FilterKey; page?: number }): string {
    const query = new URLSearchParams();
    const targetStatus = next.status ?? filter;
    if (targetStatus) query.set("status", targetStatus);
    if (search) query.set("q", search);
    if (next.page && next.page > 1) query.set("page", String(next.page));
    const suffix = query.toString();
    return suffix ? `/admin/payments?${suffix}` : "/admin/payments";
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payments"
        description="What customers have paid suppliers, and what is still unconfirmed."
      />

      <Alert tone="info" title="BuildLink does not hold this money">
        Every figure here is a record of a payment made directly between a customer and a supplier.
        BuildLink does not receive, hold or transmit funds, so there is nothing here to reconcile
        against a BuildLink account.
      </Alert>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard
          label="Confirmed by suppliers"
          value={formatZmw(totals.settledMinor)}
          icon={Receipt}
          tone="success"
        />
        <StatCard
          label="Recorded but unconfirmed"
          value={formatZmw(totals.pendingMinor)}
          hint="Waiting on the supplier to confirm the money arrived"
          tone={totals.pendingMinor > 0 ? "gold" : "default"}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Filter payments" className="flex flex-wrap gap-2">
          {FILTERS.map((option) => (
            <Button
              key={option.key || "all"}
              asChild
              size="sm"
              variant={filter === option.key ? "secondary" : "ghost"}
            >
              <Link href={hrefFor({ status: option.key, page: 1 })}>{option.label}</Link>
            </Button>
          ))}
        </nav>

        <form action="/admin/payments" className="flex items-center gap-2">
          {filter ? <input type="hidden" name="status" value={filter} /> : null}
          <label htmlFor="payment-search" className="sr-only">
            Search payments
          </label>
          <Input
            id="payment-search"
            name="q"
            type="search"
            defaultValue={search}
            placeholder="Reference, order number or customer"
            className="h-9 sm:w-72"
          />
          <Button type="submit" size="sm" variant="outline">
            <Search aria-hidden />
            Search
          </Button>
        </form>
      </div>

      {payments.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={
            filter === "PENDING"
              ? "No payment is waiting on a supplier"
              : "No payment matches this view"
          }
          description={
            filter === "PENDING"
              ? "Every recorded payment has been confirmed or rejected by the supplier who received it."
              : "Try a different status, or search for a transaction reference."
          }
          action={
            <Button asChild variant="outline">
              <Link href={hrefFor({ status: "", page: 1 })}>Show every payment</Link>
            </Button>
          }
        />
      ) : (
        <TableWrapper label="Payments recorded between customers and suppliers">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead numeric>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <span className="block font-medium text-foreground">{payment.reference}</span>
                    <span className="block text-xs text-foreground-muted">
                      {formatTimestamp(payment.createdAt)}
                    </span>
                    {payment.providerReference ? (
                      <span className="block text-xs text-foreground-subtle">
                        {payment.provider}: {payment.providerReference}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm">
                    {payment.orderId && payment.orderNumber ? (
                      <Link href={`/orders/${payment.orderId}`} className="hover:underline">
                        {payment.orderNumber}
                      </Link>
                    ) : (
                      <span className="text-foreground-muted">Wallet deposit</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{payment.customerName}</TableCell>
                  <TableCell className="text-sm">
                    {payment.supplierName ?? <span className="text-foreground-muted">—</span>}
                  </TableCell>
                  <TableCell className="text-xs text-foreground-muted">
                    {PAYMENT_METHOD_LABELS[payment.method as PaymentMethod]}
                    {isRecordedPaymentMethod(payment.method as PaymentMethod) ? (
                      <span className="block text-foreground-subtle">Paid direct</span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge tone={PAYMENT_STATUS_TONES[payment.status]} size="sm">
                      {PAYMENT_STATUS_LABELS[payment.status]}
                    </Badge>
                    {payment.failureReason ? (
                      <span className="mt-1 block text-xs text-danger-700">
                        {payment.failureReason}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell numeric>{formatZmw(payment.amountMinor)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrapper>
      )}

      {payments.length > 0 ? (
        <Pagination
          page={page}
          totalPages={pageCount}
          totalCount={total}
          pageSize={ADMIN_PAGE_SIZE}
          itemNoun="payment"
          buildHref={(target) => hrefFor({ page: target })}
        />
      ) : null}
    </div>
  );
}
