import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Calculator,
  FileText,
  FolderKanban,
  Package,
  Palette,
  Receipt,
  Search,
  ShoppingCart,
  Star,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Progress } from "@/components/ui/controls";
import { EmptyState } from "@/components/ui/feedback";
import { formatDate } from "@/components/ui/timeline";
import { requirePagePermission } from "@/lib/auth/guards";
import { getCustomerDashboard } from "@/server/projects/queries";
import { formatZmw, formatZmwShort } from "@/lib/money";
import {
  CONSTRUCTION_STAGE_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_TONES,
} from "@/lib/labels";
import { WALLET_CUSTODY_NOTICE } from "@/lib/domain/budget";
import type { OrderStatus } from "@prisma/client";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your budget, spending, orders and deliveries in one place.",
};

/**
 * Customer dashboard.
 *
 * The four headline tiles are the product's core promise made visible: total
 * budget, spent, remaining, and how far the build has actually progressed. A
 * person building a house checks these numbers more often than anything else, so
 * they come first and are readable at a glance on a phone.
 */
export default async function CustomerDashboardPage() {
  const user = await requirePagePermission("project:manage", "/customer/dashboard");
  const dashboard = await getCustomerDashboard(user);

  // No project means nothing here can say anything useful yet.
  if (dashboard.projects.length === 0) redirect("/customer/onboarding");

  const active = dashboard.activeProject;
  const { totals } = dashboard;
  const overspent = totals.remainingMinor < 0;

  return (
    <div className="space-y-7">
      <PageHeader
        title={`Hello, ${user.name.split(" ")[0]}`}
        description={
          active
            ? `${active.name} · ${CONSTRUCTION_STAGE_LABELS[active.stage]} · ${active.provinceName}`
            : "Track your build, buy materials and keep every payment on record."
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/customer/projects">
                <FolderKanban />
                My projects
              </Link>
            </Button>
            <Button asChild>
              <Link href="/marketplace">
                <Search />
                Find materials
              </Link>
            </Button>
          </>
        }
      />

      <section aria-labelledby="budget-overview">
        <h2 id="budget-overview" className="sr-only">
          Budget overview
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total budget"
            value={formatZmw(totals.plannedMinor, { compactDecimals: true })}
            hint={
              dashboard.projects.length === 1
                ? "Across your project"
                : `Across ${dashboard.projects.length} projects`
            }
            icon={Wallet}
            tone="brand"
          />
          <StatCard
            label="Spent so far"
            value={formatZmw(totals.spentMinor, { compactDecimals: true })}
            hint={`${totals.consumedPercent}% of your budget`}
            icon={Receipt}
          />
          <StatCard
            label="Remaining"
            value={formatZmw(totals.remainingMinor, { compactDecimals: true })}
            hint={overspent ? "You are over your planned budget" : "Still available to spend"}
            icon={TrendingDown}
            tone={overspent ? "danger" : "success"}
          />
          <StatCard
            label="Build progress"
            value={`${active?.progressPercent ?? 0}%`}
            hint={active ? CONSTRUCTION_STAGE_LABELS[active.stage] : "No active project"}
            icon={Package}
            tone="gold"
          />
        </div>
      </section>

      {overspent ? (
        <Alert tone="warning" title="You are over your planned budget">
          Recorded spending is {formatZmw(Math.abs(totals.remainingMinor))} above plan. Review your{" "}
          <Link href="/customer/budget" className="font-semibold underline">
            budget breakdown
          </Link>{" "}
          and move funds between categories, or raise your total budget if the scope has changed.
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {active ? (
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle as="h2">{active.name}</CardTitle>
                  <CardDescription>
                    {active.districtName ? `${active.districtName}, ` : ""}
                    {active.provinceName}
                    {active.targetCompletionDate
                      ? ` · target ${formatDate(active.targetCompletionDate)}`
                      : ""}
                  </CardDescription>
                </div>
                <Badge tone={PROJECT_STATUS_TONES[active.status]}>
                  {PROJECT_STATUS_LABELS[active.status]}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress
                  value={active.progressPercent}
                  label={`Construction progress: ${active.progressPercent}% — ${CONSTRUCTION_STAGE_LABELS[active.stage]}`}
                  tone="brand"
                />
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MiniStat label="Budget" value={formatZmwShort(active.estimatedBudgetMinor)} />
                  <MiniStat label="Spent" value={formatZmwShort(active.spentMinor)} />
                  <MiniStat
                    label="Remaining"
                    value={formatZmwShort(active.remainingMinor)}
                    tone={active.remainingMinor < 0 ? "danger" : "success"}
                  />
                  <MiniStat label="Open orders" value={String(active.openOrderCount)} />
                </dl>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/customer/projects/${active.id}`}>
                      Open project
                      <ArrowRight />
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/customer/projects/${active.id}/budget`}>Budget breakdown</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <section aria-labelledby="open-orders">
            <SectionHeading
              title="Orders in progress"
              description="Everything a supplier is still working on."
              action={
                <Button asChild variant="ghost" size="sm">
                  <Link href="/orders">
                    All orders
                    <ArrowRight />
                  </Link>
                </Button>
              }
            />
            <div className="mt-3">
              {dashboard.openOrders.length === 0 ? (
                <EmptyState
                  icon={ShoppingCart}
                  title="No orders in progress"
                  description="When you order materials, you will track confirmation, dispatch and delivery here."
                  action={
                    <Button asChild size="sm">
                      <Link href="/marketplace">Browse the marketplace</Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="space-y-2.5">
                  {dashboard.openOrders.map((order) => (
                    <li key={order.id}>
                      <Link
                        href={`/orders/${order.id}`}
                        className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3.5 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{order.supplierName}</p>
                          <p className="mt-0.5 truncate text-xs text-foreground-muted">
                            {order.orderNumber} · {order.itemCount}{" "}
                            {order.itemCount === 1 ? "item" : "items"}
                            {order.placedAt ? ` · ${formatDate(order.placedAt)}` : ""}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold tabular-nums">
                            {formatZmw(order.totalMinor, { compactDecimals: true })}
                          </p>
                          <Badge
                            tone={ORDER_STATUS_TONES[order.status as OrderStatus]}
                            size="sm"
                            className="mt-1"
                          >
                            {ORDER_STATUS_LABELS[order.status as OrderStatus]}
                          </Badge>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          {dashboard.pendingContracts > 0 ? (
            <Alert tone="warning" title="Agreements need your response">
              {dashboard.pendingContracts === 1
                ? "One supplier agreement is waiting for you to accept or decline."
                : `${dashboard.pendingContracts} supplier agreements are waiting for your response.`}{" "}
              <Link href="/customer/contracts" className="font-semibold underline">
                Review them
              </Link>
              .
            </Alert>
          ) : null}

          {dashboard.awaitingReview.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2" className="flex items-center gap-2 text-base">
                  <Star className="size-4 text-gold-600" />
                  Rate your suppliers
                </CardTitle>
                <CardDescription>
                  Your rating is what helps the next person avoid a bad supplier.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {dashboard.awaitingReview.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{order.supplierName}</p>
                      <p className="text-xs text-foreground-muted">{order.orderNumber}</p>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/orders/${order.id}/review`}>Review</Link>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-base">
                Project wallet
              </CardTitle>
              <CardDescription>
                {formatZmw(totals.walletBalanceMinor)} recorded as set aside and not yet committed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs leading-relaxed text-foreground-muted">
                {WALLET_CUSTODY_NOTICE}
              </p>
              <Button asChild size="sm" variant="outline" className="w-full">
                <Link href="/customer/budget">
                  <Wallet />
                  Budget &amp; wallet
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-base">
                Planning tools
              </CardTitle>
              <CardDescription>Work out what you need before you buy it.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <ToolLink
                href="/customer/planner"
                icon={Calculator}
                title="Material estimator"
                description="Blocks, cement and sand for your wall area."
              />
              <ToolLink
                href="/customer/finishes"
                icon={Palette}
                title="Finish and colour ideas"
                description="Upload a building photo for a paint palette."
              />
              <ToolLink
                href="/customer/contracts"
                icon={FileText}
                title="Agreements"
                description="Every supplier agreement you have signed."
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "danger";
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-foreground-subtle">{label}</dt>
      <dd
        className={
          tone === "danger"
            ? "mt-0.5 font-semibold tabular-nums text-danger-700"
            : tone === "success"
              ? "mt-0.5 font-semibold tabular-nums text-brand-700"
              : "mt-0.5 font-semibold tabular-nums"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function ToolLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-md border border-border p-3 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-brand-700" />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs text-foreground-muted">{description}</span>
      </span>
    </Link>
  );
}
