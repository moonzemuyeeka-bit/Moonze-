import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  ClipboardList,
  FileText,
  Package,
  Receipt,
  ShieldAlert,
  Store,
  Users,
} from "lucide-react";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { formatTimestamp } from "@/components/ui/timeline";
import { requirePageAdmin } from "@/lib/auth/guards";
import { getAdminDashboard } from "@/server/admin/queries";
import { getPlatformSettings } from "@/server/reference/queries";
import { formatZmw, formatZmwShort } from "@/lib/money";
import { USER_ROLE_LABELS } from "@/lib/labels";
import type { UserRole } from "@prisma/client";

export const metadata: Metadata = {
  title: "Admin",
  description: "What needs BuildLink's attention today.",
};

/**
 * The administrator's landing screen.
 *
 * It is a work queue before it is a report: the first thing on the page is what
 * is waiting on BuildLink, because a supplier whose documents sat unread for a
 * week is the failure this console exists to prevent. The money figures sit
 * below, where they inform rather than distract.
 */
export default async function AdminDashboardPage() {
  const admin = await requirePageAdmin("/admin/dashboard");
  const [dashboard, settings] = await Promise.all([getAdminDashboard(), getPlatformSettings()]);
  const { queues } = dashboard;

  const queue = [
    {
      label: "Businesses awaiting verification",
      count: queues.pendingVerifications,
      href: "/admin/suppliers?status=PENDING",
      icon: BadgeCheck,
    },
    {
      label: "Documents to review",
      count: queues.pendingDocuments,
      href: "/admin/suppliers?status=PENDING",
      icon: FileText,
    },
    {
      label: "Listings awaiting approval",
      count: queues.pendingProducts,
      href: "/admin/products?status=PENDING_APPROVAL",
      icon: Package,
    },
    {
      label: "Open disputes",
      count: queues.openDisputes,
      href: "/admin/disputes",
      icon: ShieldAlert,
    },
    {
      label: "Payments awaiting confirmation",
      count: queues.unconfirmedPayments,
      href: "/admin/payments?status=PENDING",
      icon: Receipt,
    },
    {
      label: "Agreements awaiting a response",
      count: queues.contractsAwaiting,
      href: "/admin/contracts?status=SENT",
      icon: ClipboardList,
    },
  ];

  const outstanding = queue.filter((item) => item.count > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="BuildLink administration"
        description={`Signed in as ${admin.name} · ${USER_ROLE_LABELS[admin.role as UserRole]}.`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/analytics">Platform analytics</Link>
          </Button>
        }
      />

      {settings["commission.enabled"] !== true ? (
        <Alert tone="info" title="Commission is switched off">
          Suppliers are trading free of commission. Orders record a 0% rate while this is off, and
          turning it on in{" "}
          <Link href="/admin/settings" className="font-medium">
            platform settings
          </Link>{" "}
          only affects orders placed afterwards.
        </Alert>
      ) : null}

      <section aria-labelledby="queue-heading">
        <SectionHeading
          title="Waiting on BuildLink"
          description={
            outstanding.length === 0
              ? "Nothing is queued. Every supplier, listing, payment and dispute has been dealt with."
              : "Work through these before anything else — somebody is waiting on each one."
          }
          className="mb-3"
        />
        <h2 id="queue-heading" className="sr-only">
          Work queues
        </h2>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {queue.map((item) => (
            <li key={item.label}>
              <StatCard
                label={item.label}
                value={item.count}
                icon={item.icon}
                tone={item.count === 0 ? "default" : item.count > 5 ? "danger" : "gold"}
                href={item.href}
                hint={item.count === 0 ? "Clear" : "Needs a decision"}
              />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="platform-heading" className="space-y-3">
        <h2
          id="platform-heading"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          The platform this month
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Goods sold this month"
            value={formatZmwShort(dashboard.money.gmvThisMonthMinor)}
            hint={`${formatZmw(dashboard.money.gmvAllTimeMinor)} since launch`}
            icon={Receipt}
            tone="brand"
          />
          <StatCard
            label="Commission earned this month"
            value={formatZmwShort(dashboard.money.commissionThisMonthMinor)}
            hint={
              settings["commission.enabled"] === true
                ? "Recorded against delivered and completed orders"
                : "Commission is off — this is zero by design"
            }
            icon={BadgeCheck}
          />
          <StatCard
            label="Orders this month"
            value={dashboard.orders.thisMonth}
            hint={`${dashboard.orders.open} still in progress`}
            icon={ClipboardList}
            href="/admin/orders"
          />
          <StatCard
            label="Live listings"
            value={dashboard.catalogue.liveProducts}
            hint={`${dashboard.suppliers.total} businesses registered`}
            icon={Package}
            href="/admin/products"
          />
          <StatCard
            label="People on BuildLink"
            value={dashboard.users.total}
            hint={`${dashboard.users.newThisWeek} joined in the last 7 days`}
            icon={Users}
            href="/admin/users"
          />
          <StatCard
            label="Verified suppliers"
            value={dashboard.suppliers.total - dashboard.suppliers.pendingVerification}
            hint={`${dashboard.suppliers.pendingVerification} still to review`}
            icon={Store}
            href="/admin/suppliers"
          />
        </div>
      </section>

      <section aria-labelledby="audit-heading">
        <SectionHeading
          title="Recent administrative activity"
          description="Every privileged action, with who did it."
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/audit">Full audit log</Link>
            </Button>
          }
        />
        <h2 id="audit-heading" className="sr-only">
          Recent audit entries
        </h2>

        <Card>
          <CardContent className="p-0">
            {dashboard.recentAudit.length === 0 ? (
              <p className="p-5 text-sm text-foreground-muted">
                Nothing has been recorded yet. Every administrative decision appears here.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {dashboard.recentAudit.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{entry.action}</p>
                      <p className="text-xs text-foreground-muted">
                        {entry.actor?.name ?? "System"} · {entry.resourceType}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {entry.actorRole ? (
                        <Badge tone="neutral" size="sm">
                          {USER_ROLE_LABELS[entry.actorRole]}
                        </Badge>
                      ) : null}
                      <time
                        dateTime={entry.createdAt.toISOString()}
                        className="text-xs text-foreground-muted"
                      >
                        {formatTimestamp(entry.createdAt)}
                      </time>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
