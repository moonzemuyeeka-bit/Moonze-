import type { Metadata } from "next";
import Link from "next/link";
import { PackageSearch, Receipt } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { formatDate } from "@/components/ui/timeline";
import { requirePageUser } from "@/lib/auth/guards";
import { audienceFor, listOrders, ORDERS_PAGE_SIZE } from "@/server/orders/queries";
import { formatZmw } from "@/lib/money";
import {
  DELIVERY_STATUS_LABELS,
  FULFILMENT_METHOD_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
} from "@/lib/labels";
import type { DeliveryStatus, FulfilmentMethod, OrderStatus } from "@prisma/client";

export const metadata: Metadata = {
  title: "My orders",
  description: "Every order you have placed, what it cost and where it is.",
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "open", label: "In progress" },
  { key: "closed", label: "Finished" },
] as const;

/**
 * Customer order history.
 *
 * Cards rather than a table: on a phone, "who, how much, what is happening" has
 * to be readable without horizontal scrolling, and that is all this list is for.
 */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageUser("/orders");
  const params = await searchParams;

  const filter = typeof params.filter === "string" ? params.filter : "all";
  const page = Number.parseInt(typeof params.page === "string" ? params.page : "1", 10) || 1;
  const justPlaced = params.placed === "1";

  const { orders, total, pageCount } = await listOrders(audienceFor(user), {
    status: filter === "open" ? "OPEN" : filter === "closed" ? "CLOSED" : undefined,
    page,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="My orders"
        description="Each supplier's basket becomes its own order, with its own agreement, payment and delivery."
        actions={
          <Button asChild variant="outline">
            <Link href="/marketplace">Buy more materials</Link>
          </Button>
        }
      />

      {justPlaced ? (
        <Alert tone="success" title="Order placed">
          Each supplier has been sent an agreement to accept. Once they accept, pay them directly or
          online and record it here.
        </Alert>
      ) : null}

      <nav aria-label="Filter orders" className="flex flex-wrap gap-2">
        {FILTERS.map((option) => {
          const isActive = filter === option.key || (option.key === "all" && filter === "all");
          return (
            <Button
              key={option.key}
              asChild
              size="sm"
              variant={isActive ? "secondary" : "ghost"}
            >
              <Link href={option.key === "all" ? "/orders" : `/orders?filter=${option.key}`}>
                {option.label}
              </Link>
            </Button>
          );
        })}
      </nav>

      {orders.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={filter === "all" ? "No orders yet" : "Nothing here"}
          description={
            filter === "all"
              ? "When you place an order it appears here with its agreement, payments and delivery."
              : "Try a different filter."
          }
          action={
            <Button asChild>
              <Link href="/marketplace">Browse the marketplace</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Card className="transition-shadow hover:shadow-card-hover">
                <CardContent className="p-4 sm:p-5">
                  <Link href={`/orders/${order.id}`} className="block space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {order.supplierName}
                        </p>
                        <p className="text-xs text-foreground-muted">
                          {order.orderNumber}
                          {order.placedAt ? ` · ${formatDate(order.placedAt)}` : ""}
                          {order.projectName ? ` · ${order.projectName}` : ""}
                        </p>
                      </div>
                      <Badge tone={ORDER_STATUS_TONES[order.status as OrderStatus]}>
                        {ORDER_STATUS_LABELS[order.status as OrderStatus]}
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
                        {order.outstandingMinor > 0 && !order.isClosed ? (
                          <span className="text-xs text-gold-700">
                            {formatZmw(order.outstandingMinor)} outstanding
                          </span>
                        ) : order.isClosed ? null : (
                          <span className="text-xs text-success-700">Fully paid</span>
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
          buildHref={(target) =>
            filter === "all" ? `/orders?page=${target}` : `/orders?filter=${filter}&page=${target}`
          }
        />
      ) : null}

      {orders.length > 0 ? (
        <p className="flex items-center gap-2 text-xs text-foreground-muted">
          <PackageSearch aria-hidden className="size-3.5" />
          Payments recorded here go directly to the supplier — BuildLink keeps the record, not the
          money.
        </p>
      ) : null}
    </div>
  );
}
