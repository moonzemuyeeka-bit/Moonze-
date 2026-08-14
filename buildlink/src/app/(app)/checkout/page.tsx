import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/feedback";
import { requirePagePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getCart } from "@/server/cart/queries";
import { listProjectOptions } from "@/server/projects/queries";
import { getProvinces } from "@/server/reference/queries";
import { paymentEnvironmentNotice } from "@/lib/services/payments";
import { formatZmw } from "@/lib/money";
import {
  FULFILMENT_METHOD_LABELS,
  FULFILMENT_METHODS,
  PRODUCT_UNIT_SHORT,
} from "@/lib/labels";
import type { FulfilmentMethod } from "@prisma/client";
import { CheckoutForm } from "./checkout-form";
import { FulfilmentPicker } from "./fulfilment-picker";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Confirm delivery, attach a project and place your orders.",
};

/**
 * Checkout.
 *
 * One basket becomes one order per supplier, so this page shows the split
 * explicitly rather than hiding it behind a single total: each supplier has its
 * own minimum order, delivery arrangement, agreement and payment, and a customer
 * about to commit money deserves to see that before they press the button.
 *
 * The fulfilment choice lives in the query string so the server — the only place
 * that knows each supplier's delivery fee rules — recomputes the totals.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePagePermission("order:place", "/checkout");
  const params = await searchParams;

  const fulfilment = parseFulfilment(params.fulfilment);
  const requestedProjectId = typeof params.projectId === "string" ? params.projectId : null;

  const [cart, projects, provinces, profile] = await Promise.all([
    getCart(user.id, fulfilment),
    listProjectOptions(user.id),
    getProvinces(),
    db.customerProfile.findUnique({
      where: { userId: user.id },
      select: { phone: true, provinceId: true, districtId: true },
    }),
  ]);

  const { summary } = cart;

  if (summary.lineCount === 0) {
    return (
      <div>
        <PageHeader title="Checkout" breadcrumbs={[{ label: "Cart", href: "/cart" }, { label: "Checkout" }]} />
        <EmptyState
          icon={ShoppingCart}
          title="There is nothing to check out"
          description="Your cart is empty. Add the materials you need and come back."
          action={
            <Button asChild>
              <Link href="/marketplace">Browse the marketplace</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!summary.isCheckoutable) {
    redirect("/cart");
  }

  const selection: Record<string, FulfilmentMethod> = Object.fromEntries(
    summary.groups.map((group) => [group.supplier.id, group.fulfilmentMethod]),
  );
  const needsAddress = summary.groups.some(
    (group) => group.fulfilmentMethod !== "CUSTOMER_PICKUP",
  );
  const projectId =
    requestedProjectId && projects.some((project) => project.id === requestedProjectId)
      ? requestedProjectId
      : (cart.projectId ?? null);

  const notice = paymentEnvironmentNotice();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Checkout"
        description={
          summary.supplierCount === 1
            ? "One supplier, one order. Confirm the details below."
            : `${summary.supplierCount} suppliers, so ${summary.supplierCount} separate orders — each with its own agreement and delivery.`
        }
        breadcrumbs={[{ label: "Cart", href: "/cart" }, { label: "Checkout" }]}
      />

      {notice ? <Alert tone={notice.tone}>{notice.message}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-base">
                How should each supplier get the materials to you?
              </CardTitle>
              <CardDescription>
                Delivery is priced by each supplier. Choosing collection removes the fee.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FulfilmentPicker
                projectId={projectId}
                suppliers={summary.groups.map((group) => ({
                  id: group.supplier.id,
                  businessName: group.supplier.businessName,
                  method: group.fulfilmentMethod,
                  deliveryAvailable: group.supplier.deliveryAvailable,
                  deliveryFeeMinor: group.deliveryFeeMinor,
                  subtotalMinor: group.subtotalMinor,
                  freeDeliveryAboveMinor: group.supplier.deliveryFreeAboveMinor,
                  location: group.supplier.districtName
                    ? `${group.supplier.districtName}, ${group.supplier.provinceName}`
                    : group.supplier.provinceName,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-base">
                Delivery and contact details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CheckoutForm
                provinces={provinces}
                projects={projects}
                fulfilment={selection}
                needsAddress={needsAddress}
                projectId={projectId}
                defaults={{
                  contactName: user.name,
                  contactPhone: profile?.phone ?? "",
                  provinceId: profile?.provinceId ?? null,
                  districtId: profile?.districtId ?? null,
                  locationDetail: null,
                }}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {summary.groups.map((group) => (
            <Card key={group.supplier.id}>
              <CardHeader className="gap-1 pb-3">
                <CardTitle as="h2" className="text-sm">
                  {group.supplier.businessName}
                </CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="neutral" size="sm">
                    {FULFILMENT_METHOD_LABELS[group.fulfilmentMethod]}
                  </Badge>
                  {group.supplier.verificationStatus === "VERIFIED" ? (
                    <Badge tone="success" size="sm">
                      <ShieldCheck aria-hidden className="mr-1 size-3" />
                      Verified
                    </Badge>
                  ) : null}
                  {group.supplier.isDemo ? (
                    <Badge tone="neutral" size="sm">
                      Demo
                    </Badge>
                  ) : null}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <ul className="space-y-1.5 text-xs text-foreground-muted">
                  {group.lines.map((line) => (
                    <li key={line.itemId} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">
                        {line.quantity} × {line.productName}
                        <span className="text-foreground-subtle">
                          {" "}
                          / {PRODUCT_UNIT_SHORT[line.unit]}
                        </span>
                      </span>
                      <span className="tabular shrink-0">{formatZmw(line.lineTotalMinor)}</span>
                    </li>
                  ))}
                </ul>
                <dl className="space-y-1 border-t border-border pt-2 text-sm">
                  <SummaryRow label="Subtotal" value={formatZmw(group.subtotalMinor)} />
                  <SummaryRow
                    label={
                      group.fulfilmentMethod === "THIRD_PARTY_DELIVERY"
                        ? "Transport (quoted later)"
                        : "Delivery"
                    }
                    value={
                      group.deliveryFeeMinor > 0 ? formatZmw(group.deliveryFeeMinor) : "Free"
                    }
                  />
                  <SummaryRow label="Order total" value={formatZmw(group.totalMinor)} strong />
                </dl>
              </CardContent>
            </Card>
          ))}

          <Card className="border-brand-200 bg-brand-50">
            <CardContent className="space-y-1.5 p-5">
              <dl className="space-y-1 text-sm">
                <SummaryRow label="Items" value={String(summary.itemCount)} />
                <SummaryRow label="Subtotal" value={formatZmw(summary.subtotalMinor)} />
                <SummaryRow
                  label="Delivery"
                  value={
                    summary.deliveryFeeMinor > 0 ? formatZmw(summary.deliveryFeeMinor) : "Free"
                  }
                />
                <div className="border-t border-brand-200 pt-2">
                  <SummaryRow label="Total to pay" value={formatZmw(summary.totalMinor)} strong />
                </div>
              </dl>
              <p className="pt-1 text-xs text-brand-900/80">
                Paid directly to each supplier. BuildLink does not hold or transmit your funds.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={strong ? "font-semibold" : "text-foreground-muted"}>{label}</dt>
      <dd className={strong ? "tabular font-semibold" : "tabular"}>{value}</dd>
    </div>
  );
}

/**
 * Reads the `supplierId:METHOD` pairs from the query string. Anything malformed
 * is dropped rather than rejected: an unrecognised supplier simply falls back to
 * its default fulfilment.
 */
function parseFulfilment(
  raw: string | string[] | undefined,
): Record<string, FulfilmentMethod> {
  const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const selection: Record<string, FulfilmentMethod> = {};

  for (const entry of entries) {
    const separator = entry.lastIndexOf(":");
    if (separator <= 0) continue;
    const supplierId = entry.slice(0, separator);
    const method = entry.slice(separator + 1) as FulfilmentMethod;
    if ((FULFILMENT_METHODS as readonly string[]).includes(method)) {
      selection[supplierId] = method;
    }
  }

  return selection;
}
