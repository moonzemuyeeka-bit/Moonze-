import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Search } from "lucide-react";
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
import { countOrdersByStatus, listOrders, ORDERS_PAGE_SIZE } from "@/server/orders/queries";
import { formatZmw } from "@/lib/money";
import {
  DELIVERY_STATUS_LABELS,
  FULFILMENT_METHOD_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  ORDER_STATUSES,
} from "@/lib/labels";
import type { DeliveryStatus, FulfilmentMethod, OrderStatus } from "@prisma/client";

export const metadata: Metadata = {
  title: "Orders",
  description: "Every order on the platform, whoever placed it.",
};

const FILTERS = [
  { key: "OPEN", label: "In progress" },
  { key: "DISPUTED", label: "Disputed" },
  { key: "CLOSED", label: "Finished" },
  { key: "", label: "All orders" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function asFilter(value: string | undefined): FilterKey | OrderStatus {
  const match = FILTERS.find((filter) => filter.key === value);
  if (match) return match.key;
  return value && (ORDER_STATUSES as readonly string[]).includes(value)
    ? (value as OrderStatus)
    : "OPEN";
}

/**
 * Platform-wide order oversight.
 *
 * This is a read-only window: administrators need to answer "what is happening
 * with order BL-2026-4F21A9" without becoming a party to it, so the row links to
 * the same order page the customer sees rather than offering shortcuts that would
 * bypass the state machine.
 */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageAdmin("/admin/orders");
  const params = await searchParams;

  const filter = asFilter(typeof params.status === "string" ? params.status : undefined);
  const search = typeof params.q === "string" ? params.q.trim() : "";
  const page = parsePage(params.page);

  const [{ orders, total, pageCount }, counts] = await Promise.all([
    listOrders(
      { kind: "admin" },
      {
        status: filter === "" ? undefined : (filter as OrderStatus | "OPEN" | "CLOSED"),
        search: search || undefined,
        page,
      },
    ),
    countOrdersByStatus({ kind: "admin" }),
  ]);

  function hrefFor(next: { status?: string; page?: number }): string {
    const query = new URLSearchParams();
    const targetStatus = next.status ?? filter;
    if (targetStatus) query.set("status", targetStatus);
    if (search) query.set("q", search);
    if (next.page && next.page > 1) query.set("page", String(next.page));
    const suffix = query.toString();
    return suffix ? `/admin/orders?${suffix}` : "/admin/orders";
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Orders"
        description={`${total} order${total === 1 ? "" : "s"} in this view. ${counts.DISPUTED ?? 0} disputed across the platform.`}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Filter orders" className="flex flex-wrap gap-2">
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

        <form action="/admin/orders" className="flex items-center gap-2">
          {filter ? <input type="hidden" name="status" value={filter} /> : null}
          <label htmlFor="order-search" className="sr-only">
            Search orders
          </label>
          <Input
            id="order-search"
            name="q"
            type="search"
            defaultValue={search}
            placeholder="Order number, customer or supplier"
            className="h-9 sm:w-72"
          />
          <Button type="submit" size="sm" variant="outline">
            <Search aria-hidden />
            Search
          </Button>
        </form>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No order matches this view"
          description="Try a different filter, or search by order number, customer or supplier."
          action={
            <Button asChild variant="outline">
              <Link href={hrefFor({ status: "", page: 1 })}>Show every order</Link>
            </Button>
          }
        />
      ) : (
        <TableWrapper label="Every order on the platform">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fulfilment</TableHead>
                <TableHead numeric>Total</TableHead>
                <TableHead numeric>Unpaid</TableHead>
                <TableHead>
                  <span className="sr-only">Open</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <span className="block font-medium text-foreground">{order.orderNumber}</span>
                    <span className="block text-xs text-foreground-muted">
                      {order.placedAt ? formatDate(order.placedAt) : "Not placed"} ·{" "}
                      {order.itemCount} {order.itemCount === 1 ? "line" : "lines"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {order.customerName}
                    {order.projectName ? (
                      <span className="block text-xs text-foreground-muted">
                        {order.projectName}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm">
                    <Link
                      href={`/marketplace/suppliers/${order.supplierSlug}`}
                      className="hover:underline"
                    >
                      {order.supplierName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge tone={ORDER_STATUS_TONES[order.status]} size="sm">
                      {ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-foreground-muted">
                    {FULFILMENT_METHOD_LABELS[order.fulfilmentMethod as FulfilmentMethod]}
                    {order.deliveryStatus ? (
                      <span className="block">
                        {DELIVERY_STATUS_LABELS[order.deliveryStatus as DeliveryStatus]}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell numeric>{formatZmw(order.totalMinor)}</TableCell>
                  <TableCell numeric>
                    {order.outstandingMinor > 0 ? (
                      <span className="text-gold-700">{formatZmw(order.outstandingMinor)}</span>
                    ) : (
                      <span className="text-success-700">Paid</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/orders/${order.id}`}>Open</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrapper>
      )}

      {orders.length > 0 ? (
        <Pagination
          page={page}
          totalPages={pageCount}
          totalCount={total}
          pageSize={ORDERS_PAGE_SIZE}
          itemNoun="order"
          buildHref={(target) => hrefFor({ page: target })}
        />
      ) : null}
    </div>
  );
}
