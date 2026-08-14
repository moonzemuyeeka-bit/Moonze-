import type { Metadata } from "next";
import Link from "next/link";
import { Ban, CheckCircle2, Eye, Receipt, Star, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/feedback";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrapper,
} from "@/components/ui/table";
import { CategoryRevenueChart, MonthlyRevenueChart } from "@/components/charts/supplier-charts";
import { requirePageSupplier } from "@/lib/auth/guards";
import { getSupplierAnalytics } from "@/server/suppliers/queries";
import { formatZmw, percentageOf } from "@/lib/money";
import { FULFILMENT_METHOD_LABELS, PRODUCT_UNIT_SHORT } from "@/lib/labels";
import type { FulfilmentMethod } from "@prisma/client";

export const metadata: Metadata = {
  title: "Analytics",
  description: "What sells, what does not, and how your business is trading.",
};

const WINDOWS = [
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 3 months" },
  { days: 365, label: "Last year" },
] as const;

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit" });

/**
 * Supplier analytics.
 *
 * Built to answer a trader's questions rather than a marketer's: what earned
 * money, what is sitting in the yard, and how often an order fell through.
 * Everything is drawn from orders, so the numbers here reconcile with the order
 * book — a dashboard a supplier cannot reconcile is a dashboard they ignore.
 */
export default async function SupplierAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supplier } = await requirePageSupplier("/supplier/analytics");
  const params = await searchParams;

  const requested = Number(typeof params.window === "string" ? params.window : "90");
  const days = WINDOWS.some((option) => option.days === requested) ? requested : 90;

  const analytics = await getSupplierAnalytics(supplier.id, days);
  const { orders, monthly, topProducts, neverSold, rating, fulfilment, categoryRevenue } = analytics;

  const completionRate = percentageOf(orders.completed, orders.total);
  const cancellationRate = percentageOf(orders.cancelled, orders.total);
  const fulfilmentTotal = fulfilment.reduce((total, row) => total + row.count, 0);
  const topRevenueMinor = topProducts[0]?.revenueMinor ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="How your business has traded, and which listings are earning their place in your catalogue."
      />

      <nav aria-label="Reporting period" className="flex flex-wrap gap-2">
        {WINDOWS.map((option) => (
          <Button
            key={option.days}
            asChild
            size="sm"
            variant={days === option.days ? "secondary" : "ghost"}
          >
            <Link href={`/supplier/analytics?window=${option.days}`}>{option.label}</Link>
          </Button>
        ))}
      </nav>

      {orders.total === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No trading in this period"
          description="Analytics fill in as customers order from you. Listings with photographs, honest stock figures and a clear description are the ones that get found and bought."
          action={
            <Button asChild>
              <Link href="/supplier/products">Review your listings</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Revenue"
              value={formatZmw(analytics.revenueMinor, { compactDecimals: true })}
              hint="Delivered and completed orders only"
              icon={Receipt}
              tone="brand"
            />
            <StatCard
              label="Orders completed"
              value={`${orders.completed} of ${orders.total}`}
              hint={`${completionRate}% of orders placed with you`}
              icon={CheckCircle2}
            />
            <StatCard
              label="Average order"
              value={formatZmw(analytics.averageOrderMinor, { compactDecimals: true })}
              hint="Across completed orders"
              icon={TrendingUp}
            />
            <StatCard
              label="Cancelled"
              value={String(orders.cancelled)}
              hint={`${cancellationRate}% of orders — cancellations lower your trust score`}
              icon={Ban}
              tone={cancellationRate >= 10 ? "danger" : "default"}
            />
          </div>

          {cancellationRate >= 10 ? (
            <Alert tone="warning" title="Your cancellation rate is high">
              {cancellationRate}% of orders in this period were cancelled. The usual cause is stock
              figures that are out of date, so a customer buys something that is not in the yard.
              Keeping stock current is the cheapest way to protect your ranking.
            </Alert>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle as="h2" className="text-base">
                  Revenue by month
                </CardTitle>
                <CardDescription>Delivered and completed orders, by the month placed.</CardDescription>
              </CardHeader>
              <CardContent>
                <MonthlyRevenueChart
                  data={monthly.map((row) => ({
                    label: MONTH_FORMATTER.format(row.month),
                    orders: row.orders,
                    revenueMinor: row.revenueMinor,
                  }))}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle as="h2" className="text-base">
                  Where the money comes from
                </CardTitle>
                <CardDescription>Revenue by product category.</CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryRevenueChart data={categoryRevenue} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-base">
                Your best sellers
              </CardTitle>
              <CardDescription>
                By revenue, from orders that reached the customer.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {topProducts.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-foreground-muted">
                  Nothing has completed in this period yet.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {topProducts.map((product) => (
                    <li key={product.name} className="px-5 py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-medium">{product.name}</p>
                        <p className="tabular text-sm font-semibold">
                          {formatZmw(product.revenueMinor, { compactDecimals: true })}
                        </p>
                      </div>
                      <div
                        aria-hidden
                        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100"
                      >
                        <div
                          className="h-full rounded-full bg-brand-600"
                          style={{
                            width: `${topRevenueMinor > 0 ? Math.max(4, Math.round((product.revenueMinor / topRevenueMinor) * 100)) : 0}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-foreground-muted">
                        {product.quantity} sold
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle as="h2" className="text-base">
                  How customers took delivery
                </CardTitle>
                <CardDescription>
                  Worth knowing before you buy another truck — or stop running one.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {fulfilment.length === 0 ? (
                  <p className="text-sm text-foreground-muted">No orders in this period.</p>
                ) : (
                  <dl className="space-y-3">
                    {fulfilment.map((row) => {
                      const share = percentageOf(row.count, fulfilmentTotal);
                      return (
                        <div key={row.method}>
                          <div className="flex items-baseline justify-between gap-2 text-sm">
                            <dt>{FULFILMENT_METHOD_LABELS[row.method as FulfilmentMethod]}</dt>
                            <dd className="tabular text-foreground-muted">
                              {row.count} · {share}%
                            </dd>
                          </div>
                          <div aria-hidden className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
                            <div
                              className="h-full rounded-full bg-brand-500"
                              style={{ width: `${share}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </dl>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle as="h2" className="flex items-center gap-2 text-base">
                  <Star aria-hidden className="size-4 text-gold-600" />
                  What customers say
                </CardTitle>
                <CardDescription>Published reviews across all time.</CardDescription>
              </CardHeader>
              <CardContent>
                {rating.count === 0 ? (
                  <p className="text-sm text-foreground-muted">
                    No reviews yet. A customer can review you once an order is complete, and reviews
                    are the largest single input to your trust score.
                  </p>
                ) : (
                  <div className="space-y-1">
                    <p className="tabular text-3xl font-semibold">{rating.average.toFixed(1)}</p>
                    <p className="text-sm text-foreground-muted">
                      out of 5, from {rating.count} review{rating.count === 1 ? "" : "s"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {neverSold.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle as="h2" className="text-base">
              Listings that have never sold
            </CardTitle>
            <CardDescription>
              Live listings with no orders. Views without orders usually mean the price, the minimum
              order or the photographs — not the demand.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <TableWrapper label="Live listings that have never sold" className="rounded-none border-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Listing</TableHead>
                    <TableHead numeric>Price</TableHead>
                    <TableHead numeric>Views</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {neverSold.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Link
                          href={`/supplier/products/${product.id}`}
                          className="font-medium hover:text-brand-700 hover:underline"
                        >
                          {product.name}
                        </Link>
                      </TableCell>
                      <TableCell numeric>
                        {formatZmw(product.priceMinor, { compactDecimals: true })}
                        <span className="text-foreground-muted">
                          {" "}
                          / {PRODUCT_UNIT_SHORT[product.unit]}
                        </span>
                      </TableCell>
                      <TableCell numeric>
                        <span className="inline-flex items-center gap-1.5">
                          <Eye aria-hidden className="size-3.5 text-foreground-muted" />
                          {product.viewCount}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-xs text-foreground-muted">
        Figures cover orders placed in the selected period. Revenue counts orders that reached the
        customer, so an order still in progress is not included.
      </p>
    </div>
  );
}
