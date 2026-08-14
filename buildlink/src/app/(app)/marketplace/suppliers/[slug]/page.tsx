import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Progress } from "@/components/ui/controls";
import { EmptyState } from "@/components/ui/feedback";
import { StarRating } from "@/components/ui/star-rating";
import { formatDate } from "@/components/ui/timeline";
import { ProductCard } from "@/components/marketplace/product-card";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getSupplierBySlug,
  listSupplierReviews,
  searchProducts,
} from "@/server/marketplace/queries";
import { formatZmw } from "@/lib/money";
import { initialsFrom } from "@/lib/utils";
import {
  TRUST_BAND_LABELS,
} from "@/lib/domain/trust-score";
import {
  VERIFICATION_STATUS_EXPLAINERS,
  VERIFICATION_STATUS_LABELS,
  VERIFICATION_STATUS_TONES,
} from "@/lib/labels";
import { ANALYTICS_EVENTS, track } from "@/lib/services/analytics";
import { parseSearchParams } from "@/lib/validation/marketplace";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supplier = await getSupplierBySlug(slug);
  if (!supplier) return { title: "Supplier not found" };

  return {
    title: supplier.businessName,
    description:
      supplier.description?.slice(0, 155) ??
      `${supplier.businessName} supplies building materials in ${supplier.province.name}, Zambia.`,
  };
}

/**
 * Supplier profile.
 *
 * The trust score is shown with its factors spelled out rather than as a bare
 * number: a buyer deciding whether to send ZMW 40,000 to a business they have
 * never met is entitled to know what the score is made of, and which parts
 * BuildLink has actually verified.
 */
export default async function SupplierPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, raw] = await Promise.all([params, searchParams]);
  const supplier = await getSupplierBySlug(slug);
  if (!supplier) notFound();

  const page = parsePage(raw.page);
  const [products, reviews, user] = await Promise.all([
    searchProducts({ ...parseSearchParams(raw), supplierSlug: slug, page }, { pageSize: 9 }),
    listSupplierReviews(supplier.id),
    getCurrentUser(),
  ]);

  await track({
    name: ANALYTICS_EVENTS.supplierViewed,
    userId: user?.id ?? null,
    properties: { supplierId: supplier.id },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title={supplier.businessName}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1">
              <MapPin aria-hidden className="size-3.5" />
              {supplier.district?.name ? `${supplier.district.name}, ` : ""}
              {supplier.province.name}
            </span>
            <span className="flex items-center gap-1">
              <CalendarDays aria-hidden className="size-3.5" />
              On BuildLink since {formatDate(supplier.createdAt)}
            </span>
            {supplier.yearsOperating ? (
              <span>{supplier.yearsOperating} years trading</span>
            ) : null}
          </span>
        }
        breadcrumbs={[
          { label: "Marketplace", href: "/marketplace" },
          { label: "Suppliers", href: "/marketplace/suppliers" },
          { label: supplier.businessName },
        ]}
        actions={
          <Button asChild>
            <Link href={`/marketplace?supplier=${supplier.slug}`}>
              <Package />
              Shop all {supplier.productCount} products
            </Link>
          </Button>
        }
      />

      {supplier.isSuspended ? (
        <Alert tone="danger" title="Trading suspended">
          {supplier.suspendedReason ??
            "BuildLink has suspended this supplier while it reviews reported issues. Do not send payment."}
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
              <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-muted text-lg font-semibold text-foreground-muted">
                {supplier.logoUrl ? (
                  <Image
                    src={supplier.logoUrl}
                    alt={`${supplier.businessName} logo`}
                    fill
                    sizes="4rem"
                    className="object-cover"
                  />
                ) : (
                  initialsFrom(supplier.businessName)
                )}
              </span>

              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={VERIFICATION_STATUS_TONES[supplier.verificationStatus]}>
                    {supplier.verificationStatus === "VERIFIED" ? (
                      <ShieldCheck aria-hidden className="mr-1 size-3.5" />
                    ) : null}
                    {VERIFICATION_STATUS_LABELS[supplier.verificationStatus]}
                  </Badge>
                  {supplier.isDemo ? <Badge tone="neutral">Demo supplier</Badge> : null}
                  {supplier.deliveryAvailable ? (
                    <Badge tone="info">
                      <Truck aria-hidden className="mr-1 size-3" />
                      Delivers
                    </Badge>
                  ) : null}
                </div>

                <p className="text-xs leading-relaxed text-foreground-muted">
                  {VERIFICATION_STATUS_EXPLAINERS[supplier.verificationStatus]}
                  {supplier.verifiedAt
                    ? ` Verified on ${formatDate(supplier.verifiedAt)}.`
                    : ""}
                </p>

                {supplier.description ? (
                  <p className="text-sm leading-relaxed text-foreground-muted">
                    {supplier.description}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  <StarRating
                    ratingBps={supplier.ratingAverageBps}
                    reviewCount={supplier.ratingCount}
                  />
                  <span className="text-foreground-muted">
                    {supplier.completedOrders} completed{" "}
                    {supplier.completedOrders === 1 ? "order" : "orders"}
                  </span>
                </div>

                {supplier.categories.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {supplier.categories.map((category) => (
                      <li key={category.id}>
                        <Link
                          href={`/marketplace?category=${category.slug}&supplier=${supplier.slug}`}
                          className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-foreground-muted transition-colors hover:border-brand-300 hover:text-brand-700"
                        >
                          {category.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <section aria-labelledby="supplier-products">
            <SectionHeading
              title="Products"
              description={`${products.totalCount} active ${products.totalCount === 1 ? "listing" : "listings"}.`}
            />
            {products.items.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No products listed yet"
                description="This supplier has not published any listings. Check back, or browse other suppliers in the same categories."
                action={
                  <Button asChild size="sm">
                    <Link href="/marketplace">Browse the marketplace</Link>
                  </Button>
                }
              />
            ) : (
              <div className="space-y-4">
                <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {products.items.map((product) => (
                    <li key={product.id} className="min-w-0">
                      <ProductCard product={product} />
                    </li>
                  ))}
                </ul>
                <Pagination
                  page={products.page}
                  totalPages={products.totalPages}
                  totalCount={products.totalCount}
                  pageSize={products.pageSize}
                  itemNoun="product"
                  buildHref={(nextPage) =>
                    nextPage > 1
                      ? `/marketplace/suppliers/${supplier.slug}?page=${nextPage}`
                      : `/marketplace/suppliers/${supplier.slug}`
                  }
                />
              </div>
            )}
          </section>

          <section aria-labelledby="supplier-reviews">
            <SectionHeading
              title="Customer reviews"
              description="From customers who completed an order with this supplier."
            />
            {reviews.length === 0 ? (
              <EmptyState
                title="No reviews yet"
                description="Reviews appear once customers complete orders. Only verified buyers can leave one."
              />
            ) : (
              <ul className="space-y-3">
                {reviews.map((review) => (
                  <li
                    key={review.id}
                    className="rounded-xl border border-border bg-surface p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <StarRating ratingBps={review.rating * 10_000} showCount={false} size="sm" />
                      <p className="text-xs text-foreground-muted">
                        {review.customerName} · {formatDate(review.createdAt)} ·{" "}
                        {review.orderNumber}
                      </p>
                    </div>
                    {review.comment ? (
                      <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
                        {review.comment}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-base">
                Trust score {supplier.trust.score}/100
              </CardTitle>
              <CardDescription>
                {TRUST_BAND_LABELS[supplier.trust.band]} — computed from verification, ratings,
                completed orders, cancellations, delivery reliability and disputes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress
                value={supplier.trust.score}
                tone={
                  supplier.trust.score >= 70
                    ? "brand"
                    : supplier.trust.score >= 45
                      ? "gold"
                      : "danger"
                }
                label={`Trust score ${supplier.trust.score} out of 100`}
              />

              <ul className="space-y-2.5">
                {supplier.trust.factors.map((factor) => (
                  <li key={factor.key} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-medium text-foreground">{factor.label}</span>
                      <span className="tabular-nums text-foreground-muted">
                        {factor.points}/{factor.maxPoints}
                      </span>
                    </div>
                    <p className="text-xs text-foreground-muted">{factor.detail}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-base">
                Buying from this supplier
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Detail
                label="Minimum order"
                value={
                  supplier.minimumOrderMinor > 0
                    ? formatZmw(supplier.minimumOrderMinor)
                    : "No minimum"
                }
              />
              <Detail
                label="Delivery"
                value={
                  supplier.deliveryAvailable
                    ? supplier.deliveryBaseFeeMinor > 0
                      ? `${formatZmw(supplier.deliveryBaseFeeMinor)} per trip`
                      : "Free delivery"
                    : "Collection only"
                }
              />
              {supplier.deliveryFreeAboveMinor ? (
                <Detail
                  label="Free delivery above"
                  value={formatZmw(supplier.deliveryFreeAboveMinor)}
                />
              ) : null}
              {supplier.deliveryNotes ? (
                <p className="rounded-md bg-surface-muted p-3 text-xs text-foreground-muted">
                  {supplier.deliveryNotes}
                </p>
              ) : null}
              {supplier.address ? <Detail label="Address" value={supplier.address} /> : null}
              <p className="flex items-center gap-2 text-xs text-foreground-muted">
                <Phone aria-hidden className="size-3.5" />
                Contact details are shared with you once an order is placed.
              </p>
            </CardContent>
          </Card>

          <Alert tone="info" title="BuildLink does not hold your money">
            Payments go directly to the supplier. BuildLink records the order, the agreement and
            each payment so you have a trail if something goes wrong.
          </Alert>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs uppercase tracking-wide text-foreground-subtle">{label}</span>
      <span className="min-w-0 text-right font-medium">{value}</span>
    </div>
  );
}
