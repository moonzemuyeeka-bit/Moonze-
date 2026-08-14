import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  FileText,
  Package,
  PackageSearch,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Truck,
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
import { requirePageSupplier } from "@/lib/auth/guards";
import { getSupplierDashboard } from "@/server/suppliers/queries";
import { formatZmw, ratingFromBasisPoints } from "@/lib/money";
import {
  FULFILMENT_METHOD_LABELS,
  ORDER_STATUS_LABELS_SUPPLIER,
  ORDER_STATUS_TONES,
  VERIFICATION_STATUS_EXPLAINERS,
  VERIFICATION_STATUS_LABELS,
  VERIFICATION_STATUS_TONES,
} from "@/lib/labels";
import { TRUST_BAND_LABELS } from "@/lib/domain/trust-score";
import type { FulfilmentMethod } from "@prisma/client";

export const metadata: Metadata = {
  title: "Supplier dashboard",
  description: "Orders to confirm, stock to watch and how your business is trading.",
};

/**
 * Supplier console home.
 *
 * Ordered by urgency, not by importance to BuildLink: orders waiting on this
 * supplier come first, then stock that will lose them a sale, then the numbers.
 * A supplier opening this on a phone at the yard gate should see what to do
 * without scrolling.
 */
export default async function SupplierDashboardPage() {
  const { supplier } = await requirePageSupplier("/supplier/dashboard");
  const dashboard = await getSupplierDashboard(supplier.id);
  const { profile, actions, trust, revenue } = dashboard;

  const needsAttention =
    actions.awaitingConfirmation +
    actions.pendingContracts +
    actions.deliveriesToArrange +
    actions.lowStock +
    actions.pendingProducts;

  return (
    <div className="space-y-7">
      <PageHeader
        title={profile.businessName}
        description={`${profile.district?.name ? `${profile.district.name}, ` : ""}${profile.province.name} · joined ${formatDate(profile.createdAt)}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/marketplace/suppliers/${profile.slug}`}>
                <PackageSearch />
                View public profile
              </Link>
            </Button>
            <Button asChild>
              <Link href="/supplier/products/new">
                <Plus />
                Add a product
              </Link>
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={VERIFICATION_STATUS_TONES[profile.verificationStatus]}>
            {VERIFICATION_STATUS_LABELS[profile.verificationStatus]}
          </Badge>
          {profile.isDemo ? <Badge tone="neutral">Demonstration business</Badge> : null}
          <span className="text-xs text-foreground-muted">
            {VERIFICATION_STATUS_EXPLAINERS[profile.verificationStatus]}
          </span>
        </div>
      </PageHeader>

      {profile.isSuspended ? (
        <Alert tone="danger" title="Trading is suspended">
          {profile.suspendedReason ??
            "BuildLink has suspended this business while an issue is reviewed."}{" "}
          Your listings are hidden and you cannot receive new orders. Contact BuildLink support.
        </Alert>
      ) : null}

      {profile.verificationStatus !== "VERIFIED" && !profile.isSuspended ? (
        <Alert tone="info" title="Get verified to win more orders">
          Customers can see that BuildLink has not yet verified your registration documents.
          Uploading your PACRA certificate, ZRA tax clearance and a director&apos;s NRC is the
          single biggest thing you can do to increase your trust score.{" "}
          <Link href="/supplier/verification" className="font-semibold underline">
            Upload documents
          </Link>
          .
        </Alert>
      ) : null}

      <section aria-labelledby="supplier-actions">
        <h2 id="supplier-actions" className="sr-only">
          What needs your attention
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Waiting on you"
            value={String(actions.awaitingConfirmation)}
            hint="Orders where payment needs confirming"
            icon={ClipboardCheck}
            tone={actions.awaitingConfirmation > 0 ? "gold" : "default"}
            href="/supplier/orders?status=OPEN"
          />
          <StatCard
            label="In progress"
            value={String(actions.inProgress)}
            hint="Confirmed orders you are fulfilling"
            icon={ShoppingBag}
            href="/supplier/orders"
          />
          <StatCard
            label="Deliveries to arrange"
            value={String(actions.deliveriesToArrange)}
            hint="Dispatch or hand to a transporter"
            icon={Truck}
            tone={actions.deliveriesToArrange > 0 ? "brand" : "default"}
            href="/supplier/orders?status=OPEN"
          />
          <StatCard
            label="Revenue recorded"
            value={formatZmw(revenue.totalMinor, { compactDecimals: true })}
            hint={`${revenue.orderCount} delivered or completed order${revenue.orderCount === 1 ? "" : "s"}`}
            icon={Wallet}
            tone="brand"
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {needsAttention === 0 ? (
            <Alert tone="success" title="Nothing is waiting on you">
              Every order is moving and your catalogue is healthy. Adding products and keeping stock
              figures accurate is the best use of your time right now.
            </Alert>
          ) : null}

          {actions.lowStock > 0 || actions.pendingProducts > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2" className="flex items-center gap-2 text-base">
                  <AlertTriangle className="size-4 text-gold-600" />
                  Catalogue needs attention
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {actions.lowStock > 0 ? (
                  <p>
                    <strong>
                      {actions.lowStock} live listing{actions.lowStock === 1 ? "" : "s"}
                    </strong>{" "}
                    {actions.lowStock === 1 ? "is" : "are"} at or below the low-stock level you set.
                    A customer who orders what you cannot supply is a cancellation.{" "}
                    <Link
                      href="/supplier/products?filter=attention"
                      className="font-medium text-brand-700 underline"
                    >
                      Update stock
                    </Link>
                    .
                  </p>
                ) : null}
                {actions.pendingProducts > 0 ? (
                  <p>
                    <strong>
                      {actions.pendingProducts} listing{actions.pendingProducts === 1 ? "" : "s"}
                    </strong>{" "}
                    {actions.pendingProducts === 1 ? "is" : "are"} in draft or awaiting BuildLink
                    approval, so customers cannot buy {actions.pendingProducts === 1 ? "it" : "them"}{" "}
                    yet.{" "}
                    <Link
                      href="/supplier/products?filter=attention"
                      className="font-medium text-brand-700 underline"
                    >
                      Review them
                    </Link>
                    .
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <section aria-labelledby="recent-orders">
            <SectionHeading
              title="Recent orders"
              description="The last six orders customers placed with you."
              action={
                <Button asChild variant="ghost" size="sm">
                  <Link href="/supplier/orders">
                    All orders
                    <ArrowRight />
                  </Link>
                </Button>
              }
            />
            {dashboard.recentOrders.length === 0 ? (
              <EmptyState
                icon={ShoppingBag}
                title="No orders yet"
                description="Once your listings are approved they appear in search results, and orders land here. Complete listings with clear photos and honest stock figures sell first."
                action={
                  <Button asChild size="sm">
                    <Link href="/supplier/products/new">Add a product</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-2.5">
                {dashboard.recentOrders.map((order) => (
                  <li key={order.id}>
                    <Link
                      href={`/supplier/orders/${order.id}`}
                      className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3.5 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{order.customer.name}</p>
                        <p className="mt-0.5 truncate text-xs text-foreground-muted">
                          {order.orderNumber} · {order._count.items}{" "}
                          {order._count.items === 1 ? "item" : "items"} ·{" "}
                          {FULFILMENT_METHOD_LABELS[order.fulfilmentMethod as FulfilmentMethod]}
                          {order.placedAt ? ` · ${formatDate(order.placedAt)}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums">
                          {formatZmw(order.totalMinor, { compactDecimals: true })}
                        </p>
                        <Badge tone={ORDER_STATUS_TONES[order.status]} size="sm" className="mt-1">
                          {ORDER_STATUS_LABELS_SUPPLIER[order.status]}
                        </Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-brand-700" />
                Trust score
              </CardTitle>
              <CardDescription>
                {trust.score} out of 100 · {TRUST_BAND_LABELS[trust.band]}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress
                value={trust.score}
                label={`Trust score ${trust.score} out of 100`}
                tone={trust.score >= 65 ? "brand" : trust.score >= 45 ? "gold" : "danger"}
              />
              <dl className="space-y-2">
                {trust.factors.map((factor) => (
                  <div key={factor.key} className="text-xs">
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="font-medium text-foreground">{factor.label}</dt>
                      <dd className="tabular-nums text-foreground-muted">
                        {factor.points}
                        {factor.maxPoints > 0 ? ` / ${factor.maxPoints}` : ""}
                      </dd>
                    </div>
                    <p className="text-foreground-muted">{factor.detail}</p>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-base">
                Your record
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Metric
                  label="Rating"
                  value={
                    profile.ratingCount === 0
                      ? "No reviews"
                      : `${ratingFromBasisPoints(profile.ratingAverageBps).toFixed(1)} / 5`
                  }
                  hint={
                    profile.ratingCount === 0
                      ? "Complete orders to earn reviews"
                      : `${profile.ratingCount} review${profile.ratingCount === 1 ? "" : "s"}`
                  }
                />
                <Metric
                  label="Completed"
                  value={String(profile.completedOrders)}
                  hint="Orders finished"
                />
                <Metric
                  label="Cancelled"
                  value={String(profile.cancelledOrders)}
                  hint="Orders you cancelled"
                />
                <Metric
                  label="Documents"
                  value={`${dashboard.documents.approved} / ${dashboard.documents.total}`}
                  hint="Accepted by BuildLink"
                />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-base">
                Run your business
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <ConsoleLink
                href="/supplier/products"
                icon={Package}
                title="Products and stock"
                description="Prices, photographs and what is on hand."
              />
              <ConsoleLink
                href="/supplier/contracts"
                icon={FileText}
                title="Agreements"
                description={
                  actions.pendingContracts > 0
                    ? `${actions.pendingContracts} awaiting your response.`
                    : "Written terms for the orders you take."
                }
              />
              <ConsoleLink
                href="/supplier/analytics"
                icon={BarChart3}
                title="Analytics"
                description="What sells, what does not, and when."
              />
              <ConsoleLink
                href="/supplier/verification"
                icon={ShieldCheck}
                title="Verification"
                description="Registration documents and review status."
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-foreground-subtle">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
      <p className="text-xs text-foreground-muted">{hint}</p>
    </div>
  );
}

function ConsoleLink({
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
