import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/feedback";
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
import { listDisputes } from "@/server/admin/queries";
import { formatZmw } from "@/lib/money";
import {
  DISPUTE_REASON_LABELS,
  DISPUTE_STATUSES,
  DISPUTE_STATUS_LABELS,
  DISPUTE_STATUS_TONES,
  ORDER_STATUS_LABELS,
  USER_ROLE_LABELS,
} from "@/lib/labels";
import type { DisputeStatus } from "@prisma/client";

export const metadata: Metadata = {
  title: "Disputes",
  description: "Orders a customer or supplier has escalated to BuildLink.",
};

function asStatus(value: string | undefined): DisputeStatus | "" {
  return DISPUTE_STATUSES.find((status) => status === value) ?? "";
}

/** How long a dispute has been waiting, in whole days. */
function daysOpen(from: Date): number {
  return Math.floor((Date.now() - from.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * The dispute queue.
 *
 * Ordered so that the oldest untouched dispute is at the top, because the single
 * worst outcome for this marketplace is a customer who escalated a problem and
 * heard nothing back. Everything else on this page is subordinate to that.
 */
export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageAdmin("/admin/disputes");
  const params = await searchParams;
  const status = asStatus(typeof params.status === "string" ? params.status : undefined);

  const disputes = await listDisputes({ status: status || undefined });
  const unattended = disputes.filter(
    (dispute) => dispute.status === "OPEN" && daysOpen(dispute.createdAt) >= 2,
  );

  function hrefFor(next: DisputeStatus | ""): string {
    return next ? `/admin/disputes?status=${next}` : "/admin/disputes";
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Disputes"
        description="Orders where a customer or a supplier has asked BuildLink to step in."
      />

      {unattended.length > 0 ? (
        <Alert tone="danger" title={`${unattended.length} open more than two days`}>
          Someone raised each of these and has heard nothing since. Open them, mark them under
          review so both parties know they have been seen, then decide.
        </Alert>
      ) : null}

      <nav aria-label="Filter disputes" className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant={status === "" ? "secondary" : "ghost"}>
          <Link href={hrefFor("")}>Everything</Link>
        </Button>
        {DISPUTE_STATUSES.map((option) => (
          <Button key={option} asChild size="sm" variant={status === option ? "secondary" : "ghost"}>
            <Link href={hrefFor(option)}>{DISPUTE_STATUS_LABELS[option]}</Link>
          </Button>
        ))}
      </nav>

      {disputes.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={status === "" ? "No dispute has ever been raised" : "Nothing in this view"}
          description={
            status === ""
              ? "Customers and suppliers have settled everything between themselves so far. Disputes appear here the moment one is raised."
              : "Try another status — disputes move from open, to under review, to resolved."
          }
          action={
            status === "" ? null : (
              <Button asChild variant="outline">
                <Link href={hrefFor("")}>Show every dispute</Link>
              </Button>
            )
          }
        />
      ) : (
        <TableWrapper label="Disputes raised on orders">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Raised by</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead numeric>Order value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {disputes.map((dispute) => {
                const age = daysOpen(dispute.createdAt);
                const stale = dispute.status === "OPEN" && age >= 2;

                return (
                  <TableRow key={dispute.id}>
                    <TableCell>
                      <Link
                        href={`/admin/disputes/${dispute.id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {dispute.order.orderNumber}
                      </Link>
                      <span className="block text-xs text-foreground-muted">
                        {ORDER_STATUS_LABELS[dispute.order.status]} ·{" "}
                        {formatTimestamp(dispute.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {dispute.raisedBy.name}
                      <span className="block text-xs text-foreground-muted">
                        {USER_ROLE_LABELS[dispute.raisedBy.role]}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      <Link
                        href={`/admin/suppliers/${dispute.supplier.id}`}
                        className="hover:underline"
                      >
                        {dispute.supplier.businessName}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-xs text-sm">
                      {DISPUTE_REASON_LABELS[dispute.reason]}
                      <span className="block truncate text-xs text-foreground-muted">
                        {dispute.description}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge tone={DISPUTE_STATUS_TONES[dispute.status]} size="sm">
                        {DISPUTE_STATUS_LABELS[dispute.status]}
                      </Badge>
                      {stale ? (
                        <span className="mt-1 flex items-center gap-1 text-xs text-danger-700">
                          <ShieldAlert className="size-3" aria-hidden />
                          {age} days waiting
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell numeric>{formatZmw(dispute.order.totalMinor)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableWrapper>
      )}
    </div>
  );
}
