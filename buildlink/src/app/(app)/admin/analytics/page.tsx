import type { Metadata } from "next";
import Link from "next/link";
import { Activity, BadgeCheck, ClipboardList, Receipt, Star, Users } from "lucide-react";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  PlatformTrendChart,
  ShareChart,
  ValueByNameChart,
} from "@/components/charts/platform-charts";
import { requirePageAdmin } from "@/lib/auth/guards";
import { getPlatformAnalytics } from "@/server/admin/queries";
import { getPlatformSettings } from "@/server/reference/queries";
import { formatZmw, formatZmwShort, percentageOf } from "@/lib/money";
import { FULFILMENT_METHOD_LABELS, USER_ROLE_LABELS } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Platform analytics",
  description: "Whether BuildLink is actually working: orders, value, suppliers and reach.",
};

const WINDOWS = [
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "12 months" },
] as const;

function asWindow(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return WINDOWS.some((option) => option.days === parsed) ? parsed : 90;
}

const MONTH_FORMAT = new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit" });

/**
 * Platform analytics.
 *
 * The question this page answers is not "how much did we make" — commission is
 * off at launch and the numbers would be near zero — but "is the marketplace
 * working": are orders completing, are suppliers spread across the country, and
 * is anything being sold outside Lusaka. Those are the figures that tell
 * BuildLink whether the product is doing its job.
 */
export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageAdmin("/admin/analytics");
  const params = await searchParams;
  const days = asWindow(typeof params.window === "string" ? params.window : undefined);

  const [analytics, settings] = await Promise.all([
    getPlatformAnalytics(days),
    getPlatformSettings(),
  ]);

  const completionRate = percentageOf(analytics.orders.completed, analytics.orders.placed);
  const cancellationRate = percentageOf(analytics.orders.cancelled, analytics.orders.placed);
  const commissionEarned = analytics.topSuppliers.reduce(
    (total, supplier) => total + supplier.commissionMinor,
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform analytics"
        description={`Trading across BuildLink over the last ${days === 365 ? "12 months" : `${days} days`}.`}
        actions={
          <nav aria-label="Reporting window" className="flex flex-wrap gap-2">
            {WINDOWS.map((option) => (
              <Button
                key={option.days}
                asChild
                size="sm"
                variant={days === option.days ? "secondary" : "ghost"}
              >
                <Link href={`/admin/analytics?window=${option.days}`}>{option.label}</Link>
              </Button>
            ))}
          </nav>
        }
      />

      {settings["commission.enabled"] !== true ? (
        <Alert tone="info" title="Commission is switched off">
          Orders in this window recorded no commission by design. The figures below are the value of
          goods traded between customers and suppliers — money BuildLink never touched.
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Goods traded"
          value={formatZmwShort(analytics.gmvMinor)}
          hint={`${analytics.orders.completed} orders delivered or completed`}
          icon={Receipt}
          tone="brand"
        />
        <StatCard
          label="Average order"
          value={formatZmwShort(analytics.averageOrderMinor)}
          hint="Across delivered and completed orders"
          icon={ClipboardList}
        />
        <StatCard
          label="Orders completed"
          value={`${completionRate}%`}
          hint={`${analytics.orders.placed} placed · ${cancellationRate}% cancelled`}
          icon={BadgeCheck}
          tone={completionRate >= 70 ? "success" : completionRate >= 40 ? "gold" : "danger"}
        />
        <StatCard
          label="Commission recorded"
          value={formatZmwShort(commissionEarned)}
          hint={
            settings["commission.enabled"] === true
              ? "From the busiest suppliers in this window"
              : "Zero while commission is off"
          }
          icon={Activity}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Orders and value by month</CardTitle>
        </CardHeader>
        <CardContent>
          <PlatformTrendChart
            data={analytics.monthly.map((row) => ({
              label: MONTH_FORMAT.format(row.month),
              orders: row.orders,
              gmvMinor: row.gmvMinor,
            }))}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Where the value comes from</CardTitle>
          </CardHeader>
          <CardContent>
            <ValueByNameChart
              data={analytics.topCategories.map((row) => ({
                name: row.category,
                valueMinor: row.gmvMinor,
              }))}
              caption="Goods value by product category"
              emptyMessage="No completed order in this window has a category on it yet."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How orders are fulfilled</CardTitle>
          </CardHeader>
          <CardContent>
            <ShareChart
              data={analytics.fulfilment.map((row) => ({
                name: FULFILMENT_METHOD_LABELS[row.method],
                count: row.count,
              }))}
              caption="Orders by fulfilment method"
              emptyMessage="No orders in this window."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Who is on BuildLink</CardTitle>
          </CardHeader>
          <CardContent>
            <ShareChart
              data={analytics.usersByRole.map((row) => ({
                name: USER_ROLE_LABELS[row.role],
                count: row.count,
              }))}
              caption="Accounts by role"
              emptyMessage="No accounts yet."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Supplier reach across Zambia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.suppliersByProvince.length === 0 ? (
              <p className="py-8 text-center text-sm text-foreground-muted">
                No supplier has registered a province yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {analytics.suppliersByProvince.map((row) => {
                  const share = percentageOf(
                    row.suppliers,
                    analytics.suppliersByProvince.reduce((total, item) => total + item.suppliers, 0),
                  );
                  return (
                    <li key={row.province} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{row.province}</span>
                        <span className="text-foreground-muted">
                          {row.suppliers} ({share}%)
                        </span>
                      </div>
                      <div
                        className="h-1.5 overflow-hidden rounded-full bg-surface-muted"
                        role="presentation"
                      >
                        <div
                          className="h-full rounded-full bg-brand-700"
                          style={{ width: `${Math.max(share, 2)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-xs text-foreground-subtle">
              A marketplace concentrated in one province is a Lusaka directory, not a national one.
              This is the number to watch.
            </p>
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="suppliers-heading">
        <SectionHeading
          title="Busiest suppliers"
          description="By value of goods delivered in this window."
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/suppliers">All suppliers</Link>
            </Button>
          }
        />
        <h2 id="suppliers-heading" className="sr-only">
          Busiest suppliers
        </h2>

        {analytics.topSuppliers.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm text-foreground-muted">
                No supplier has completed an order in this window.
              </p>
            </CardContent>
          </Card>
        ) : (
          <TableWrapper label="Suppliers by goods value in this window">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead numeric>Orders</TableHead>
                  <TableHead numeric>Goods value</TableHead>
                  <TableHead numeric>Commission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.topSuppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell>
                      <Link
                        href={`/admin/suppliers/${supplier.id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {supplier.name}
                      </Link>
                      {supplier.isDemo ? (
                        <Badge tone="neutral" size="sm" className="ml-2">
                          Demo
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell numeric>{supplier.orders}</TableCell>
                    <TableCell numeric>{formatZmw(supplier.gmvMinor)}</TableCell>
                    <TableCell numeric>{formatZmw(supplier.commissionMinor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customer satisfaction</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-semibold tracking-tight text-foreground">
              {analytics.rating.count === 0 ? "—" : analytics.rating.average.toFixed(2)}
              <span className="ml-1 text-sm font-normal text-foreground-muted">out of 5</span>
            </p>
            <p className="inline-flex items-center gap-1.5 text-sm text-foreground-muted">
              <Star className="size-4 text-gold-500" aria-hidden />
              {analytics.rating.count} published review
              {analytics.rating.count === 1 ? "" : "s"} from verified buyers
            </p>
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link href="/admin/reviews">Moderate reviews</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What people are doing</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.events.length === 0 ? (
              <p className="text-sm text-foreground-muted">
                No product events have been recorded in this window.
              </p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {analytics.events.map((event) => (
                  <li key={event.name} className="flex items-center justify-between gap-3">
                    <span className="truncate font-mono text-xs text-foreground-muted">
                      {event.name}
                    </span>
                    <span className="font-medium text-foreground">{event.count}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-foreground-subtle">
              <Users className="size-3.5" aria-hidden />
              Events are recorded server-side against a signed-in account, never by a third-party
              tracker in the browser.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
