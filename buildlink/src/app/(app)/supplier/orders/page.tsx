import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/feedback";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { formatDate } from "@/components/ui/timeline";
import { requirePageSupplier } from "@/lib/auth/guards";
import { countOrdersByStatus, listOrders, ORDERS_PAGE_SIZE } from "@/server/orders/queries";
import { OPEN_ORDER_STATUSES } from "@/lib/domain/order-status";
import { formatZmw } from "@/lib/money";
import {
  DELIVERY_STATUS_LABELS,
  FULFILMENT_METHOD_LABELS,
  ORDER_STATUS_LABELS_SUPPLIER,
  ORDER_STATUS_TONES,
} from "@/lib/labels";
import type { DeliveryStatus, FulfilmentMethod, OrderStatus } from "@prisma/client";

export const metadata: Metadata = {
  title: "Orders",
  description: "Orders customers have placed with your business, newest first.",
};

const FILTERS = [
  { key: "open", label: "Needs action" },
  { key: "all", label: "All orders" },
  { key: "closed", label: "Finished" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function isFilter(value: string): value is FilterKey {
  return FILTERS.some((filter) => filter.key === value);
}

/**
 * The supplier's order book.
 *
 * "Needs action" is the default view, because a supplier opening this screen is
 * asking "what do I have to do?" — not browsing history. Amounts are shown gross;
 * commission, where it applies, is on the order itself.
 */
export default async function SupplierOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supplier } = await requirePageSupplier("/supplier/orders");
  const params = await searchParams;

  const rawFilter = typeof params.filter === "string" ? params.filter : "open";
  const filter: FilterKey = isFilter(rawFilter) ? rawFilter : "open";
  const search = typeof params.q === "string" ? params.q.trim() : "";
  const page = parsePage(params.page);
  const audience = { kind: "supplier", supplierId: supplier.id } as const;

  const [{ orders, total, pageCount }, counts] = await Promise.all([
    listOrders(audience, {
      status: filter === "open" ? "OPEN" : filter === "closed" ? "CLOSED" : undefined,
      search: search || undefined,
      page,
    }),
    countOrdersByStatus(audience),
  ]);

  const openCount = OPEN_ORDER_STATUSES.reduce(
    (running, status) => running + (counts[status] ?? 0),
    0,
  );

  function hrefFor(next: { filter?: FilterKey; page?: number }): string {
    const query = new URLSearchParams();
    const targetFilter = next.filter ?? filter;
    if (targetFilter !== "open") query.set("filter", targetFilter);
    if (search) query.set("q", search);
    if (next.page && next.page > 1) query.set("page", String(next.page));
    const suffix = query.toString();
    return suffix ? `/supplier/orders?${suffix}` : "/supplier/orders";
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Orders"
        description={
          openCount > 0
            ? `${openCount} order${openCount === 1 ? "" : "s"} still need something from you.`
            : "Nothing is waiting on you right now."
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Filter orders" className="flex flex-wrap gap-2">
          {FILTERS.map((option) => (
            <Button
              key={option.key}
              asChild
              size="sm"
              variant={filter === option.key ? "secondary" : "ghost"}
            >
              <Link href={hrefFor({ filter: option.key, page: 1 })}>
                {option.label}
                {option.key === "open" && openCount > 0 ? ` (${openCount})` : ""}
              </Link>
            </Button>
          ))}
        </nav>

        <form action="/supplier/orders" className="flex items-center gap-2">
          {filter === "open" ? null : <input type="hidden" name="filter" value={filter} />}
          <label htmlFor="order-search" className="sr-only">
            Search orders
          </label>
          <Input
            id="order-search"
            name="q"
            type="search"
            defaultValue={search}
            placeholder="Order number or customer"
            className="h-9 sm:w-64"
          />
          <Button type="submit" size="sm" variant="outline">
            <Search />
            Search
          </Button>
        </form>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={
            search
              ? `No order matches “${search}”`
              : filter === "open"
                ? "Nothing is waiting on you"
                : "No orders here yet"
          }
          description={
            search
              ? "Try the order number, or the customer's name."
              : filter === "open"
                ? "Every order has been dealt with. Keeping stock figures current is the best way to win the next one."
                : "Orders customers place with your business appear here."
          }
          action={
            <Button asChild variant="outline">
              <Link href={hrefFor({ filter: "all", page: 1 })}>Show all orders</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Card className="transition-shadow hover:shadow-card-hover">
                <CardContent className="p-4 sm:p-5">
                  <Link href={`/supplier/orders/${order.id}`} className="block space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {order.customerName}
                        </p>
                        <p className="text-xs text-foreground-muted">
                          {order.orderNumber}
                          {order.placedAt ? ` · ${formatDate(order.placedAt)}` : ""}
                        </p>
                      </div>
                      <Badge tone={ORDER_STATUS_TONES[order.status as OrderStatus]}>
                        {ORDER_STATUS_LABELS_SUPPLIER[order.status as OrderStatus]}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <p className="text-xs text-foreground-muted">
                        {order.itemCount} {order.itemCount === 1 ? "line" : "lines"} ·{" "}
                        {FULFILMENT_METHOD_LABELS[order.fulfilmentMethod as FulfilmentMethod]}
                        {order.deliveryStatus
                          ? ` · ${DELIVERY_STATUS_LABELS[order.deliveryStatus as DeliveryStatus]}`
                          : ""}
                      </p>
                      <p className="text-right">
                        <span className="tabular block text-base font-semibold">
                          {formatZmw(order.totalMinor)}
                        </span>
                        {order.isClosed ? null : order.outstandingMinor > 0 ? (
                          <span className="text-xs text-gold-700">
                            {formatZmw(order.outstandingMinor)} unpaid
                          </span>
                        ) : (
                          <span className="text-xs text-success-700">Paid in full</span>
                        )}
                      </p>
                    </div>
                  </Link>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
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
