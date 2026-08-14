import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  Boxes,
  ImageOff,
  MapPin,
  Package,
  ShieldCheck,
  Store,
  Truck,
} from "lucide-react";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { StarRating } from "@/components/ui/star-rating";
import { formatDate } from "@/components/ui/timeline";
import { ProductCard } from "@/components/marketplace/product-card";
import { AddToCartForm } from "@/components/marketplace/add-to-cart-form";
import { getCurrentUser } from "@/lib/auth/session";
import { roleHasPermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import {
  getCategoryPriceBands,
  getProduct,
  listAlternatives,
} from "@/server/marketplace/queries";
import { cartQuantityFor } from "@/server/cart/queries";
import { listProjectOptions } from "@/server/projects/queries";
import { formatZmw } from "@/lib/money";
import {
  PRODUCT_UNIT_LABELS,
  PRODUCT_UNIT_SHORT,
  VERIFICATION_STATUS_EXPLAINERS,
  VERIFICATION_STATUS_LABELS,
  VERIFICATION_STATUS_TONES,
} from "@/lib/labels";
import { ANALYTICS_EVENTS, track } from "@/lib/services/analytics";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ productId: string }>;
}): Promise<Metadata> {
  const { productId } = await params;
  const product = await getProduct(productId);
  if (!product) return { title: "Product not found" };

  return {
    title: `${product.name} — ${product.supplier.businessName}`,
    description:
      product.description?.slice(0, 155) ??
      `${product.name} from ${product.supplier.businessName}, ${product.supplier.province.name}.`,
  };
}

/**
 * Product detail.
 *
 * Two jobs: give the buyer enough to commit (price per unit, stock, minimum
 * order, delivery, who is selling) and make the alternative obvious, because on
 * a construction budget the second-cheapest supplier is a real decision.
 */
export default async function ProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const product = await getProduct(productId);
  if (!product) notFound();

  const user = await getCurrentUser();
  const canBuy = user !== null && roleHasPermission(user.role, "cart:use");

  const [alternatives, priceBands, projects, quantityInCart] = await Promise.all([
    listAlternatives(product.id, product.category.id),
    getCategoryPriceBands(),
    canBuy ? listProjectOptions(user.id) : Promise.resolve([]),
    canBuy ? cartQuantityFor(user.id, product.id) : Promise.resolve(0),
  ]);

  const cart = canBuy
    ? await db.cart.findFirst({
        where: { userId: user.id, checkedOutAt: null },
        select: { projectId: true },
      })
    : null;

  // View counts drive the "popular" ordering; a failed increment must not break
  // the page, so it is fired and forgotten.
  await db.product
    .update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => undefined);
  await track({
    name: ANALYTICS_EVENTS.productViewed,
    userId: user?.id ?? null,
    properties: { productId: product.id, categorySlug: product.category.slug },
  });

  const band = priceBands.get(product.category.id);
  const isCheapest = band !== undefined && product.priceMinor <= band.minMinor;
  const isBelowAverage = band !== undefined && product.priceMinor < band.averageMinor;
  const lowStock =
    product.stockQuantity > 0 && product.stockQuantity <= Math.max(1, product.lowStockThreshold);

  return (
    <div className="space-y-8">
      <PageHeader
        title={product.name}
        description={product.brand ? `${product.brand} · ${product.category.name}` : product.category.name}
        breadcrumbs={[
          { label: "Marketplace", href: "/marketplace" },
          ...(product.category.parent
            ? [
                {
                  label: product.category.parent.name,
                  href: `/marketplace?category=${product.category.parent.slug}`,
                },
              ]
            : []),
          { label: product.category.name, href: `/marketplace?category=${product.category.slug}` },
          { label: product.name },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <div className="relative aspect-4/3 overflow-hidden rounded-xl border border-border bg-surface-muted">
            {product.images[0]?.url ? (
              <Image
                src={product.images[0].url}
                alt={product.images[0].altText ?? product.name}
                fill
                priority
                sizes="(min-width: 1024px) 40rem, 100vw"
                className="object-cover"
              />
            ) : (
              <span className="flex size-full flex-col items-center justify-center gap-2 text-ink-300">
                <ImageOff aria-hidden className="size-10" />
                <span className="text-xs">No photo provided</span>
              </span>
            )}
          </div>

          {product.images.length > 1 ? (
            <ul className="grid grid-cols-4 gap-2">
              {product.images.slice(1, 5).map((image) => (
                <li
                  key={image.id}
                  className="relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-muted"
                >
                  {image.url ? (
                    <Image
                      src={image.url}
                      alt={image.altText ?? product.name}
                      fill
                      sizes="10rem"
                      className="object-cover"
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {product.description ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2" className="text-base">
                  About this product
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground-muted">
                  {product.description}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-base">
                Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                <Detail label="Sold by unit" value={PRODUCT_UNIT_LABELS[product.unit]} />
                <Detail
                  label="Minimum order"
                  value={`${product.minimumOrderQuantity} ${PRODUCT_UNIT_SHORT[product.unit]}`}
                />
                <Detail
                  label="In stock"
                  value={`${product.stockQuantity} ${PRODUCT_UNIT_SHORT[product.unit]}`}
                />
                <Detail
                  label="Delivery"
                  value={
                    product.deliveryAvailable || product.supplier.deliveryAvailable
                      ? "Available"
                      : "Collection only"
                  }
                />
                <Detail label="Listed" value={formatDate(product.createdAt)} />
                <Detail label="Orders placed" value={String(product.purchaseCount)} />
              </dl>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-center gap-1.5">
                {product.isDemo ? <Badge tone="neutral">Demo listing</Badge> : null}
                {isCheapest ? <Badge tone="success">Lowest price in category</Badge> : null}
                {!isCheapest && isBelowAverage ? (
                  <Badge tone="info">Below category average</Badge>
                ) : null}
                {lowStock ? <Badge tone="warning">Low stock</Badge> : null}
              </div>

              <div>
                <p className="tabular text-3xl font-semibold leading-none">
                  {formatZmw(product.priceMinor)}
                </p>
                <p className="mt-1 text-sm text-foreground-muted">
                  per {PRODUCT_UNIT_SHORT[product.unit]}
                  {band && band.averageMinor > 0 ? (
                    <> · category average {formatZmw(band.averageMinor)}</>
                  ) : null}
                </p>
              </div>

              <AddToCartForm
                productId={product.id}
                unit={product.unit}
                unitPriceMinor={product.priceMinor}
                minimumOrderQuantity={product.minimumOrderQuantity}
                stockQuantity={product.stockQuantity}
                projects={projects}
                currentProjectId={cart?.projectId ?? null}
                quantityInCart={quantityInCart}
                canBuy={canBuy}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-base">
                <Link
                  href={`/marketplace/suppliers/${product.supplier.slug}`}
                  className="hover:text-brand-700 hover:underline"
                >
                  {product.supplier.businessName}
                </Link>
              </CardTitle>
              <CardDescription className="flex items-center gap-1">
                <MapPin aria-hidden className="size-3.5" />
                {product.supplier.district?.name
                  ? `${product.supplier.district.name}, `
                  : ""}
                {product.supplier.province.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={VERIFICATION_STATUS_TONES[product.supplier.verificationStatus]}>
                  {product.supplier.verificationStatus === "VERIFIED" ? (
                    <ShieldCheck aria-hidden className="mr-1 size-3.5" />
                  ) : null}
                  {VERIFICATION_STATUS_LABELS[product.supplier.verificationStatus]}
                </Badge>
                <Badge tone="neutral">Trust score {product.supplier.trustScore}/100</Badge>
              </div>

              <p className="text-xs leading-relaxed text-foreground-muted">
                {VERIFICATION_STATUS_EXPLAINERS[product.supplier.verificationStatus]}
              </p>

              <StarRating
                ratingBps={product.supplier.ratingAverageBps}
                reviewCount={product.supplier.ratingCount}
              />

              <dl className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
                <Detail
                  label="Completed orders"
                  value={String(product.supplier.completedOrders)}
                />
                <Detail
                  label="Years trading"
                  value={
                    product.supplier.yearsOperating
                      ? `${product.supplier.yearsOperating}`
                      : "Not stated"
                  }
                />
                <Detail
                  label="Minimum order"
                  value={
                    product.supplier.minimumOrderMinor > 0
                      ? formatZmw(product.supplier.minimumOrderMinor)
                      : "None"
                  }
                />
                <Detail
                  label="Delivery fee"
                  value={
                    product.supplier.deliveryAvailable
                      ? product.supplier.deliveryBaseFeeMinor > 0
                        ? formatZmw(product.supplier.deliveryBaseFeeMinor)
                        : "Free"
                      : "No delivery"
                  }
                />
              </dl>

              {product.supplier.deliveryNotes ? (
                <p className="flex items-start gap-2 rounded-md bg-surface-muted p-3 text-xs text-foreground-muted">
                  <Truck aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                  {product.supplier.deliveryNotes}
                </p>
              ) : null}

              <Button asChild variant="outline" size="sm" block>
                <Link href={`/marketplace/suppliers/${product.supplier.slug}`}>
                  <Store />
                  View supplier profile
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Alert tone="info" title="Payments go straight to the supplier">
            BuildLink records your order, your agreement and your payments. It does not hold your
            money or guarantee the supplier&apos;s work.
          </Alert>
        </div>
      </div>

      {alternatives.length > 0 ? (
        <section aria-labelledby="alternatives">
          <SectionHeading
            title="Same item, other suppliers"
            description="Compare price, stock and delivery before you commit."
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href={`/marketplace?category=${product.category.slug}`}>
                  <Boxes />
                  All in this category
                </Link>
              </Button>
            }
          />
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {alternatives.map((alternative) => (
              <li key={alternative.id} className="min-w-0">
                <ProductCard product={alternative} />
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Button asChild variant="outline" size="sm">
              <Link
                href={`/marketplace/compare?ids=${[product.id, ...alternatives.slice(0, 3).map((item) => item.id)].join(",")}`}
              >
                <Package />
                Compare these side by side
              </Link>
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-foreground-subtle">{label}</dt>
      <dd className="mt-0.5 truncate font-medium">{value}</dd>
    </div>
  );
}
