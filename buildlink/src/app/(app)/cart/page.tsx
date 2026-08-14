import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ImageOff, MapPin, ShieldCheck, ShoppingCart, Truck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/feedback";
import { requirePagePermission } from "@/lib/auth/guards";
import { getCart } from "@/server/cart/queries";
import { clearCartAction } from "@/server/cart/actions";
import { listProjectOptions } from "@/server/projects/queries";
import { fileUrl } from "@/lib/services/storage";
import { formatZmw } from "@/lib/money";
import { describeCartGroupIssue, describeCartLineIssue } from "@/lib/domain/cart";
import { PRODUCT_UNIT_SHORT, VERIFICATION_STATUS_LABELS, VERIFICATION_STATUS_TONES } from "@/lib/labels";
import { CartProjectForm, ClearCartButton, QuantityForm, RemoveItemForm } from "./cart-controls";

export const metadata: Metadata = {
  title: "Cart",
  description: "Your basket, grouped by supplier — each becomes its own order.",
};

/**
 * Cart.
 *
 * Grouped by supplier because that is what actually happens at checkout: three
 * suppliers means three orders, three agreements and three deliveries. Showing
 * one flat list would hide the minimum orders and delivery fees that decide
 * whether the basket is worth placing at all.
 */
export default async function CartPage() {
  const user = await requirePagePermission("cart:use", "/cart");
  const [cart, projects] = await Promise.all([getCart(user.id), listProjectOptions(user.id)]);

  const { summary } = cart;

  async function emptyCart(): Promise<void> {
    "use server";
    await clearCartAction();
  }

  if (summary.lineCount === 0) {
    return (
      <div>
        <PageHeader
          title="Your cart"
          description="Materials you add appear here, grouped by supplier."
        />
        <EmptyState
          icon={ShoppingCart}
          title="Your cart is empty"
          description="Search the marketplace for cement, blocks, roofing sheets or finishes and add what you need."
          action={
            <Button asChild>
              <Link href="/marketplace">Browse the marketplace</Link>
            </Button>
          }
          secondaryAction={
            <Button asChild variant="outline">
              <Link href="/customer/planner">Estimate what I need</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your cart"
        description={`${summary.itemCount} ${summary.itemCount === 1 ? "item" : "items"} from ${summary.supplierCount} ${summary.supplierCount === 1 ? "supplier" : "suppliers"}. Each supplier becomes its own order.`}
        breadcrumbs={[{ label: "Marketplace", href: "/marketplace" }, { label: "Cart" }]}
        actions={<ClearCartButton action={emptyCart} />}
      />

      {summary.blockingIssueCount > 0 ? (
        <Alert tone="warning" title="Some items need attention before checkout">
          Fix the highlighted lines below — a quantity below a supplier&apos;s minimum, or stock that
          has run out since you added it.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          {summary.groups.map((group) => (
            <Card key={group.supplier.id}>
              <CardHeader className="gap-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle as="h2" className="text-base">
                      <Link
                        href={`/marketplace/suppliers/${group.supplier.slug}`}
                        className="hover:text-brand-700 hover:underline"
                      >
                        {group.supplier.businessName}
                      </Link>
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <MapPin aria-hidden className="size-3.5" />
                      {group.supplier.districtName
                        ? `${group.supplier.districtName}, `
                        : ""}
                      {group.supplier.provinceName}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge
                      tone={VERIFICATION_STATUS_TONES[group.supplier.verificationStatus]}
                      size="sm"
                    >
                      {group.supplier.verificationStatus === "VERIFIED" ? (
                        <ShieldCheck aria-hidden className="mr-1 size-3" />
                      ) : null}
                      {VERIFICATION_STATUS_LABELS[group.supplier.verificationStatus]}
                    </Badge>
                    {group.supplier.isDemo ? (
                      <Badge tone="neutral" size="sm">
                        Demo
                      </Badge>
                    ) : null}
                  </div>
                </div>

                {group.issues.length > 0 ? (
                  <ul className="space-y-1">
                    {group.issues.map((issue) => (
                      <li key={issue.kind} className="text-xs font-medium text-danger-700">
                        {describeCartGroupIssue(issue)}
                        {issue.kind === "below_minimum_order"
                          ? ` Add ${formatZmw(issue.shortfallMinor)} more (minimum ${formatZmw(issue.minimumOrderMinor)}).`
                          : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </CardHeader>

              <CardContent className="space-y-4">
                <ul className="divide-y divide-border">
                  {group.lines.map((line) => {
                    const imageUrl = fileUrl(line.imageKey);
                    return (
                      <li key={line.itemId} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                        <Link
                          href={`/marketplace/products/${line.productId}`}
                          className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-muted"
                        >
                          {imageUrl ? (
                            <Image
                              src={imageUrl}
                              alt={line.productName}
                              fill
                              sizes="4rem"
                              className="object-cover"
                            />
                          ) : (
                            <span className="flex size-full items-center justify-center text-ink-300">
                              <ImageOff aria-hidden className="size-5" />
                            </span>
                          )}
                        </Link>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            <Link
                              href={`/marketplace/products/${line.productId}`}
                              className="hover:text-brand-700 hover:underline"
                            >
                              {line.productName}
                            </Link>
                          </p>
                          <p className="mt-0.5 text-xs text-foreground-muted">
                            {formatZmw(line.unitPriceMinor)} / {PRODUCT_UNIT_SHORT[line.unit]}
                            {line.brand ? ` · ${line.brand}` : ""}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            <QuantityForm
                              itemId={line.itemId}
                              quantity={line.quantity}
                              maxQuantity={line.stockQuantity}
                            />
                            <RemoveItemForm
                              itemId={line.itemId}
                              productName={line.productName}
                            />
                          </div>

                          {line.issues.length > 0 ? (
                            <ul className="mt-1.5 space-y-0.5">
                              {line.issues.map((issue) => (
                                <li key={issue.kind} className="text-xs text-danger-700">
                                  {describeCartLineIssue(issue)}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>

                        <p className="tabular shrink-0 text-sm font-semibold">
                          {formatZmw(line.lineTotalMinor)}
                        </p>
                      </li>
                    );
                  })}
                </ul>

                <dl className="space-y-1 border-t border-border pt-3 text-sm">
                  <Row label="Subtotal" value={formatZmw(group.subtotalMinor)} />
                  <Row
                    label={
                      group.fulfilmentMethod === "CUSTOMER_PICKUP"
                        ? "Collection"
                        : "Delivery (estimated)"
                    }
                    value={
                      group.deliveryFeeMinor > 0 ? formatZmw(group.deliveryFeeMinor) : "Free"
                    }
                  />
                  <Row label="Supplier total" value={formatZmw(group.totalMinor)} strong />
                </dl>

                {group.supplier.deliveryAvailable ? (
                  <p className="flex items-center gap-1.5 text-xs text-foreground-muted">
                    <Truck aria-hidden className="size-3.5" />
                    You choose delivery or collection for this supplier at checkout.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-base">
                Order summary
              </CardTitle>
              <CardDescription>
                {summary.supplierCount === 1
                  ? "One order will be created."
                  : `${summary.supplierCount} separate orders will be created.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="space-y-1.5 text-sm">
                <Row label="Items" value={String(summary.itemCount)} />
                <Row label="Subtotal" value={formatZmw(summary.subtotalMinor)} />
                <Row
                  label="Delivery (estimated)"
                  value={
                    summary.deliveryFeeMinor > 0 ? formatZmw(summary.deliveryFeeMinor) : "Free"
                  }
                />
                <div className="border-t border-border pt-2">
                  <Row label="Total" value={formatZmw(summary.totalMinor)} strong />
                </div>
              </dl>

              <Button asChild size="lg" block disabled={!summary.isCheckoutable}>
                <Link href="/checkout">
                  Continue to checkout
                  <ArrowRight />
                </Link>
              </Button>

              {!summary.isCheckoutable ? (
                <p className="text-xs text-danger-700">
                  Resolve the highlighted items before checking out.
                </p>
              ) : null}

              <Button asChild variant="ghost" size="sm" block>
                <Link href="/marketplace">Keep shopping</Link>
              </Button>
            </CardContent>
          </Card>

          {projects.length > 0 ? (
            <Card>
              <CardContent className="p-5">
                <CartProjectForm projects={projects} currentProjectId={cart.projectId} />
              </CardContent>
            </Card>
          ) : null}

          <Alert tone="info" title="Delivery is quoted per supplier">
            Figures here are estimates from each supplier&apos;s standard fee. The final delivery
            arrangement and cost are confirmed at checkout.
          </Alert>
        </div>
      </div>
    </div>
  );
}

function Row({
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
