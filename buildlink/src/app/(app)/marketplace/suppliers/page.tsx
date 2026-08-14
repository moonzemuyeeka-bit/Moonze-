import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Package, ShieldCheck, Store, Truck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { StarRating } from "@/components/ui/star-rating";
import { SearchBox } from "@/components/marketplace/search-controls";
import { listSuppliers, type SupplierListItem } from "@/server/marketplace/queries";
import { getCategories, getProvinces } from "@/server/reference/queries";
import { initialsFrom } from "@/lib/utils";
import { VERIFICATION_STATUS_LABELS, VERIFICATION_STATUS_TONES } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Suppliers",
  description: "Verified building material suppliers, quarries and timber yards across Zambia.",
};

/**
 * Supplier directory.
 *
 * Ordered by trust score, so the businesses that have actually delivered come
 * first — a directory sorted alphabetically would reward nothing but a name
 * starting with A.
 */
export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const q = typeof raw.q === "string" ? raw.q.trim() : null;
  const provinceId = typeof raw.province === "string" ? raw.province : null;
  const categorySlug = typeof raw.category === "string" ? raw.category : null;
  const verifiedOnly = raw.verified === "1";
  const page = parsePage(raw.page);

  const [provinces, categories, results] = await Promise.all([
    getProvinces(),
    getCategories(),
    listSuppliers({ q, provinceId, categorySlug, verifiedOnly, page }),
  ]);

  function href(changes: Record<string, string | null>): string {
    const query = new URLSearchParams();
    const base: Record<string, string | null> = {
      q,
      province: provinceId,
      category: categorySlug,
      verified: verifiedOnly ? "1" : null,
      page: page > 1 ? String(page) : null,
    };
    for (const [key, value] of Object.entries({ ...base, ...changes })) {
      if (value) query.set(key, value);
    }
    const search = query.toString();
    return search ? `/marketplace/suppliers?${search}` : "/marketplace/suppliers";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description={`${results.totalCount} businesses selling building materials on BuildLink.`}
        breadcrumbs={[{ label: "Marketplace", href: "/marketplace" }, { label: "Suppliers" }]}
        actions={
          <Button asChild variant="outline">
            <Link href="/marketplace">
              <Package />
              Browse products
            </Link>
          </Button>
        }
      />

      <SearchBox
        basePath="/marketplace/suppliers"
        defaultValue={q}
        placeholder="Search by business name…"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={href({ verified: verifiedOnly ? null : "1", page: null })}
          className={
            verifiedOnly
              ? "rounded-full border border-brand-600 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800"
              : "rounded-full border border-border bg-surface px-3 py-1 text-xs text-foreground-muted hover:border-brand-300"
          }
        >
          <ShieldCheck aria-hidden className="mr-1 inline size-3.5" />
          Verified only
        </Link>

        {provinceId ? (
          <Link
            href={href({ province: null, page: null })}
            className="rounded-full border border-brand-600 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800"
          >
            {provinces.find((province) => province.id === provinceId)?.name ?? "Province"} ×
          </Link>
        ) : null}

        {categorySlug ? (
          <Link
            href={href({ category: null, page: null })}
            className="rounded-full border border-brand-600 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800"
          >
            {categories.find((category) => category.slug === categorySlug)?.name ?? "Category"} ×
          </Link>
        ) : null}
      </div>

      {results.items.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No suppliers matched"
          description="Try a different name, or clear the filters to see every supplier on BuildLink."
          action={
            <Button asChild>
              <Link href="/marketplace/suppliers">Clear filters</Link>
            </Button>
          }
        />
      ) : (
        <>
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {results.items.map((supplier) => (
              <li key={supplier.id} className="min-w-0">
                <SupplierCard supplier={supplier} />
              </li>
            ))}
          </ul>

          <Pagination
            page={results.page}
            totalPages={results.totalPages}
            totalCount={results.totalCount}
            pageSize={results.pageSize}
            itemNoun="supplier"
            buildHref={(nextPage) => href({ page: nextPage > 1 ? String(nextPage) : null })}
          />
        </>
      )}
    </div>
  );
}

function SupplierCard({ supplier }: { supplier: SupplierListItem }) {
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-start gap-3">
          <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-muted text-sm font-semibold text-foreground-muted">
            {supplier.logoUrl ? (
              <Image
                src={supplier.logoUrl}
                alt={`${supplier.businessName} logo`}
                fill
                sizes="3rem"
                className="object-cover"
              />
            ) : (
              initialsFrom(supplier.businessName)
            )}
          </span>

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold">
              <Link
                href={`/marketplace/suppliers/${supplier.slug}`}
                className="hover:text-brand-700 hover:underline"
              >
                {supplier.businessName}
              </Link>
            </h2>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-foreground-muted">
              <MapPin aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">
                {supplier.districtName ? `${supplier.districtName}, ` : ""}
                {supplier.provinceName}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={VERIFICATION_STATUS_TONES[supplier.verificationStatus]} size="sm">
            {VERIFICATION_STATUS_LABELS[supplier.verificationStatus]}
          </Badge>
          {supplier.isDemo ? (
            <Badge tone="neutral" size="sm">
              Demo
            </Badge>
          ) : null}
          {supplier.deliveryAvailable ? (
            <Badge tone="info" size="sm">
              <Truck aria-hidden className="mr-1 size-3" />
              Delivers
            </Badge>
          ) : null}
        </div>

        {supplier.description ? (
          <p className="line-clamp-2 text-xs text-foreground-muted">{supplier.description}</p>
        ) : null}

        <div className="mt-auto space-y-2 border-t border-border pt-3">
          <StarRating
            ratingBps={supplier.ratingAverageBps}
            reviewCount={supplier.ratingCount}
            size="sm"
          />
          <dl className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt className="text-foreground-subtle">Products</dt>
              <dd className="font-semibold tabular-nums">{supplier.productCount}</dd>
            </div>
            <div>
              <dt className="text-foreground-subtle">Orders</dt>
              <dd className="font-semibold tabular-nums">{supplier.completedOrders}</dd>
            </div>
            <div>
              <dt className="text-foreground-subtle">Trust</dt>
              <dd className="font-semibold tabular-nums">{supplier.trustScore}/100</dd>
            </div>
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}
