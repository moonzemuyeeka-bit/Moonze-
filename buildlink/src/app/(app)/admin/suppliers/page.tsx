import type { Metadata } from "next";
import Link from "next/link";
import { Search, Store } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/feedback";
import { Pagination, parsePage } from "@/components/ui/pagination";
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
import { ADMIN_PAGE_SIZE, listSuppliersForAdmin } from "@/server/admin/queries";
import { formatRating } from "@/lib/money";
import { VERIFICATION_STATUS_LABELS, VERIFICATION_STATUS_TONES } from "@/lib/labels";
import type { VerificationStatus } from "@prisma/client";

export const metadata: Metadata = {
  title: "Suppliers",
  description: "Every registered business, and where its verification stands.",
};

const FILTERS = [
  { key: "PENDING", label: "Awaiting verification" },
  { key: "VERIFIED", label: "Verified" },
  { key: "UNVERIFIED", label: "Not submitted" },
  { key: "REJECTED", label: "Rejected" },
  { key: "SUSPENDED_ONLY", label: "Suspended" },
  { key: "", label: "All businesses" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function asFilter(value: string | undefined): FilterKey {
  const match = FILTERS.find((filter) => filter.key === value);
  return match ? match.key : "PENDING";
}

/**
 * The verification queue.
 *
 * It opens on businesses waiting to be checked, because a verified badge is
 * BuildLink telling a customer it has seen the paperwork — and the value of that
 * promise comes entirely from this queue being worked.
 */
export default async function AdminSuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageAdmin("/admin/suppliers");
  const params = await searchParams;

  const filter = asFilter(typeof params.status === "string" ? params.status : undefined);
  const search = typeof params.q === "string" ? params.q.trim() : "";
  const page = parsePage(params.page);

  const { suppliers, total, pageCount } = await listSuppliersForAdmin({
    status: filter === "" ? undefined : (filter as VerificationStatus | "SUSPENDED_ONLY"),
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
    return suffix ? `/admin/suppliers?${suffix}` : "/admin/suppliers";
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Suppliers"
        description={`${total} business${total === 1 ? "" : "es"} in this view.`}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Filter suppliers" className="flex flex-wrap gap-2">
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

        <form action="/admin/suppliers" className="flex items-center gap-2">
          {filter ? <input type="hidden" name="status" value={filter} /> : null}
          <label htmlFor="supplier-search" className="sr-only">
            Search suppliers
          </label>
          <Input
            id="supplier-search"
            name="q"
            type="search"
            defaultValue={search}
            placeholder="Business, email or PACRA number"
            className="h-9 sm:w-64"
          />
          <Button type="submit" size="sm" variant="outline">
            <Search aria-hidden />
            Search
          </Button>
        </form>
      </div>

      {suppliers.length === 0 ? (
        <EmptyState
          icon={Store}
          title={
            filter === "PENDING"
              ? "No business is waiting on verification"
              : "No business matches this view"
          }
          description={
            filter === "PENDING"
              ? "The queue is clear. New applications land here as soon as documents are submitted."
              : "Try a different filter, or search for part of the business name."
          }
          action={
            <Button asChild variant="outline">
              <Link href={hrefFor({ status: "", page: 1 })}>Show every business</Link>
            </Button>
          }
        />
      ) : (
        <TableWrapper label="Registered supplier businesses">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Verification</TableHead>
                <TableHead>Where</TableHead>
                <TableHead numeric>Listings</TableHead>
                <TableHead numeric>Completed</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead>
                  <span className="sr-only">Open</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-foreground">{supplier.businessName}</span>
                      {supplier.isDemo ? (
                        <Badge tone="neutral" size="sm">
                          Demo
                        </Badge>
                      ) : null}
                      {supplier.isSuspended ? (
                        <Badge tone="danger" size="sm">
                          Suspended
                        </Badge>
                      ) : null}
                    </span>
                    <span className="block text-xs text-foreground-muted">
                      {supplier.contactName} · {supplier.contactEmail}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge tone={VERIFICATION_STATUS_TONES[supplier.verificationStatus]} size="sm">
                      {VERIFICATION_STATUS_LABELS[supplier.verificationStatus]}
                    </Badge>
                    {supplier.documentsPending > 0 ? (
                      <span className="mt-1 block text-xs text-gold-700">
                        {supplier.documentsPending} document
                        {supplier.documentsPending === 1 ? "" : "s"} to read
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs text-foreground-muted">
                    {supplier.districtName
                      ? `${supplier.districtName}, ${supplier.provinceName}`
                      : supplier.provinceName}
                  </TableCell>
                  <TableCell numeric>{supplier.productCount}</TableCell>
                  <TableCell numeric>{supplier.completedOrders}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {supplier.ratingCount === 0
                      ? "No reviews"
                      : `${formatRating(supplier.ratingAverageBps)} (${supplier.ratingCount})`}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-foreground-muted">
                    {formatDate(supplier.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/admin/suppliers/${supplier.id}`}>Review</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrapper>
      )}

      {suppliers.length > 0 ? (
        <Pagination
          page={page}
          totalPages={pageCount}
          totalCount={total}
          pageSize={ADMIN_PAGE_SIZE}
          itemNoun="supplier"
          buildHref={(target) => hrefFor({ page: target })}
        />
      ) : null}
    </div>
  );
}
