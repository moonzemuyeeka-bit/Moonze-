import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/feedback";
import { formatDate } from "@/components/ui/timeline";
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
import { listContracts } from "@/server/contracts/queries";
import { formatZmw } from "@/lib/money";
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_TONES, USER_ROLE_LABELS } from "@/lib/labels";
import type { ContractStatus } from "@prisma/client";

export const metadata: Metadata = {
  title: "Agreements",
  description: "Every agreement between a customer and a supplier.",
};

const FILTERS = [
  { key: "SENT", label: "Awaiting a response" },
  { key: "ACCEPTED", label: "Accepted" },
  { key: "REJECTED", label: "Rejected" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "", label: "All agreements" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function asFilter(value: string | undefined): FilterKey {
  const match = FILTERS.find((filter) => filter.key === value);
  return match ? match.key : "SENT";
}

/**
 * Agreement audit.
 *
 * Agreements are the record of what two parties said they would do, so this
 * screen is read-only by design: an administrator can read any of them for a
 * dispute, but nobody at BuildLink can accept or alter one on a party's behalf.
 */
export default async function AdminContractsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageAdmin("/admin/contracts");
  const params = await searchParams;

  const filter = asFilter(typeof params.status === "string" ? params.status : undefined);
  const contracts = await listContracts(
    { kind: "admin" },
    filter === "" ? {} : { status: filter as ContractStatus },
  );

  const value = contracts.reduce((running, contract) => running + contract.totalMinor, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Agreements"
        description={`${contracts.length} agreement${contracts.length === 1 ? "" : "s"} in this view, worth ${formatZmw(value)}.`}
      />

      <Alert tone="neutral" title="What an agreement is on BuildLink">
        A structured record of what was ordered, at what price, on what terms, with who accepted it
        and when. It is not presented to either party as a legally enforceable instrument, and
        BuildLink is not a party to it.
      </Alert>

      <nav aria-label="Filter agreements" className="flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <Button
            key={option.key || "all"}
            asChild
            size="sm"
            variant={filter === option.key ? "secondary" : "ghost"}
          >
            <Link href={option.key ? `/admin/contracts?status=${option.key}` : "/admin/contracts"}>
              {option.label}
            </Link>
          </Button>
        ))}
      </nav>

      {contracts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={
            filter === "SENT"
              ? "No agreement is waiting on anybody"
              : "No agreement matches this view"
          }
          description={
            filter === "SENT"
              ? "Every agreement that has been sent has had a response."
              : "Agreements are generated automatically when an order is placed."
          }
          action={
            <Button asChild variant="outline">
              <Link href="/admin/contracts">Show every agreement</Link>
            </Button>
          }
        />
      ) : (
        <TableWrapper label="Agreements between customers and suppliers">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agreement</TableHead>
                <TableHead>Parties</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Put forward by</TableHead>
                <TableHead numeric>Value</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Answered</TableHead>
                <TableHead>
                  <span className="sr-only">Read</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell>
                    <span className="block font-medium text-foreground">
                      {contract.contractNumber}
                    </span>
                    {contract.orderId && contract.orderNumber ? (
                      <Link
                        href={`/orders/${contract.orderId}`}
                        className="block text-xs text-foreground-muted hover:underline"
                      >
                        {contract.orderNumber}
                      </Link>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm">
                    {contract.customerName}
                    <span className="block text-xs text-foreground-muted">
                      {contract.supplierName}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge tone={CONTRACT_STATUS_TONES[contract.status]} size="sm">
                      {CONTRACT_STATUS_LABELS[contract.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-foreground-muted">
                    {USER_ROLE_LABELS[contract.createdByRole]}
                  </TableCell>
                  <TableCell numeric>{formatZmw(contract.totalMinor)}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-foreground-muted">
                    {contract.sentAt ? formatDate(contract.sentAt) : "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-foreground-muted">
                    {contract.respondedAt ? formatDate(contract.respondedAt) : "—"}
                  </TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/agreements/${contract.id}`}>Read</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrapper>
      )}
    </div>
  );
}
