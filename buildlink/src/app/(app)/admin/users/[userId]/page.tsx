import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, MapPin, Phone, Store, Truck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { StatCard } from "@/components/ui/stat-card";
import { formatDate, formatTimestamp } from "@/components/ui/timeline";
import { requirePageAdmin } from "@/lib/auth/guards";
import { isAdminRole } from "@/lib/auth/permissions";
import { getUserForAdmin } from "@/server/admin/queries";
import { NotFoundError } from "@/lib/errors";
import { formatZmw } from "@/lib/money";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  USER_ROLE_LABELS,
  USER_STATUS_LABELS,
  USER_STATUS_TONES,
  VERIFICATION_STATUS_LABELS,
} from "@/lib/labels";
import { ChangeRoleDialog, SuspendUserDialog } from "./user-actions";

export const metadata: Metadata = {
  title: "Account",
};

/**
 * One account, as support sees it.
 *
 * The point of this screen is answering a person on the phone: who are they, what
 * have they bought, what state is their account in, and what did BuildLink last
 * do to it. The audit strip at the bottom is what makes the last question
 * answerable.
 */
export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const admin = await requirePageAdmin(`/admin/users/${userId}`);

  const user = await getUserForAdmin(userId).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  const isSelf = user.id === admin.id;
  // Only a super administrator may act on another administrator's account.
  const canActOnAccount = !isSelf && (!isAdminRole(user.role) || admin.role === "SUPER_ADMIN");

  return (
    <div className="space-y-6">
      <PageHeader
        title={user.name}
        description={`${USER_ROLE_LABELS[user.role]} · joined ${formatDate(user.createdAt)}.`}
        breadcrumbs={[{ label: "Users", href: "/admin/users" }, { label: user.name }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={USER_STATUS_TONES[user.status]} size="md">
              {USER_STATUS_LABELS[user.status]}
            </Badge>
            {canActOnAccount ? (
              <SuspendUserDialog
                userId={user.id}
                name={user.name}
                status={user.status}
                isSupplier={user.supplierProfile !== null}
              />
            ) : null}
            {admin.role === "SUPER_ADMIN" && !isSelf ? (
              <ChangeRoleDialog userId={user.id} name={user.name} role={user.role} />
            ) : null}
          </div>
        }
      />

      {isSelf ? (
        <Alert tone="info" title="This is your own account">
          BuildLink does not let an administrator change their own role or status. Ask another super
          administrator if you need it changed.
        </Alert>
      ) : null}

      {user.lockedUntil && user.lockedUntil > new Date() ? (
        <Alert tone="warning" title="Sign-in is temporarily locked">
          {user.failedLogins} failed attempts. The lock lifts at{" "}
          {formatTimestamp(user.lockedUntil)}.
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Orders placed" value={user._count.orders} />
        <StatCard label="Lifetime spend" value={formatZmw(user.lifetimeSpendMinor)} tone="brand" />
        <StatCard label="Projects" value={user._count.projects} />
        <StatCard label="Reviews written" value={user._count.reviews} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle as="h2" className="text-base">
              Contact and verification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex items-center gap-2">
              <Mail aria-hidden className="size-3.5 text-foreground-muted" />
              <a href={`mailto:${user.email}`} className="hover:underline">
                {user.email}
              </a>
              {user.emailVerifiedAt ? (
                <Badge tone="success" size="sm">
                  Verified
                </Badge>
              ) : (
                <Badge tone="neutral" size="sm">
                  Unverified
                </Badge>
              )}
            </p>
            <p className="flex items-center gap-2">
              <Phone aria-hidden className="size-3.5 text-foreground-muted" />
              {user.phone ? (
                <a href={`tel:${user.phone}`} className="hover:underline">
                  {user.phone}
                </a>
              ) : (
                <span className="text-foreground-muted">No phone number given</span>
              )}
              {user.phone && user.phoneVerifiedAt ? (
                <Badge tone="success" size="sm">
                  Verified
                </Badge>
              ) : null}
            </p>
            {user.customerProfile?.province ? (
              <p className="flex items-center gap-2">
                <MapPin aria-hidden className="size-3.5 text-foreground-muted" />
                {user.customerProfile.district?.name
                  ? `${user.customerProfile.district.name}, ${user.customerProfile.province.name}`
                  : user.customerProfile.province.name}
              </p>
            ) : null}
            <p className="text-xs text-foreground-muted">
              {user.lastLoginAt
                ? `Last signed in ${formatTimestamp(user.lastLoginAt)}.`
                : "Has never signed in."}{" "}
              {user._count.sessions} active session
              {user._count.sessions === 1 ? "" : "s"}.
            </p>
            {user.customerProfile ? (
              <p className="text-xs text-foreground-muted">
                {user.customerProfile.onboardingCompletedAt
                  ? `Finished onboarding ${formatDate(user.customerProfile.onboardingCompletedAt)}.`
                  : "Has not finished the onboarding wizard."}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2" className="text-base">
              Businesses
            </CardTitle>
            <CardDescription>What this person operates on BuildLink.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {user.supplierProfile ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    <Store aria-hidden className="size-3.5 text-foreground-muted" />
                    {user.supplierProfile.businessName}
                  </p>
                  <p className="text-xs text-foreground-muted">
                    {VERIFICATION_STATUS_LABELS[user.supplierProfile.verificationStatus]}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/suppliers/${user.supplierProfile.id}`}>Open business</Link>
                </Button>
              </div>
            ) : null}

            {user.deliveryProvider ? (
              <div className="flex items-center gap-2 rounded-lg border border-border p-3">
                <Truck aria-hidden className="size-3.5 text-foreground-muted" />
                <span className="font-medium">{user.deliveryProvider.businessName}</span>
                <Badge tone="neutral" size="sm">
                  Transport
                </Badge>
              </div>
            ) : null}

            {!user.supplierProfile && !user.deliveryProvider ? (
              <p className="text-foreground-muted">
                No supplier or transport business. This is a buying account.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-base">
            Recent orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {user.orders.length === 0 ? (
            <p className="text-sm text-foreground-muted">This account has not placed an order.</p>
          ) : (
            <ul className="divide-y divide-border">
              {user.orders.map((order) => (
                <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link
                      href={`/orders/${order.id}`}
                      className="text-sm font-medium hover:text-brand-700 hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                    <p className="text-xs text-foreground-muted">
                      {order.supplier.businessName} · {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={ORDER_STATUS_TONES[order.status]} size="sm">
                      {ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                    <span className="tabular text-sm font-semibold">
                      {formatZmw(order.totalMinor)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-base">
            Audit trail
          </CardTitle>
          <CardDescription>
            Actions this person took, and actions BuildLink took on their account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user.audit.length === 0 ? (
            <p className="text-sm text-foreground-muted">Nothing recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {user.audit.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span className="font-medium">{entry.action}</span>
                  <span className="text-xs text-foreground-muted">
                    {entry.actor?.name ?? "System"} · {formatTimestamp(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
