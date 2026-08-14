import type { Metadata } from "next";
import Link from "next/link";
import { PackageSearch, Store } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { CategoryIcon } from "@/components/ui/category-icon";
import { ProductCard } from "@/components/marketplace/product-card";
import {
  FilterPanel,
  SearchBox,
  SortSelect,
} from "@/components/marketplace/search-controls";
import { getCurrentUser } from "@/lib/auth/session";
import { getCategories, getProvinces } from "@/server/reference/queries";
import { getMarketplaceStats, searchProducts } from "@/server/marketplace/queries";
import { buildSearchHref, parseSearchParams } from "@/lib/validation/marketplace";
import { POPULAR_SEARCHES, findCategoryBySlug } from "@/lib/catalogue";
import { ANALYTICS_EVENTS, track } from "@/lib/services/analytics";

export const metadata: Metadata = {
  title: "Marketplace",
  description:
    "Compare building materials from verified Zambian suppliers — cement, blocks, roofing, plumbing, electrical and finishes.",
};

/**
 * Marketplace search.
 *
 * Everything that shapes the result set is a URL parameter, so this page is a
 * pure function of its query string: shareable, back-button-correct and
 * server-rendered on the first paint, which matters on a 3G connection.
 */
export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = parseSearchParams(raw);

  const [user, categories, provinces, results, stats] = await Promise.all([
    getCurrentUser(),
    getCategories(),
    getProvinces(),
    searchProducts(params),
    getMarketplaceStats(),
  ]);

  if (params.q) {
    await track({
      name: ANALYTICS_EVENTS.productSearched,
      userId: user?.id ?? null,
      properties: { resultCount: results.totalCount, sort: params.sort },
    });
  }

  const activeCategory = params.categorySlug
    ? categories.find((category) => category.slug === params.categorySlug)
    : undefined;
  const catalogueEntry = params.categorySlug ? findCategoryBySlug(params.categorySlug) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={activeCategory ? activeCategory.name : "Marketplace"}
        description={
          activeCategory?.description ??
          `${stats.products} listings from ${stats.suppliers} suppliers across Zambia. ${stats.verifiedSuppliers} are verified.`
        }
        breadcrumbs={
          activeCategory
            ? [{ label: "Marketplace", href: "/marketplace" }, { label: activeCategory.name }]
            : undefined
        }
        actions={
          <Button asChild variant="outline">
            <Link href="/marketplace/suppliers">
              <Store />
              Browse suppliers
            </Link>
          </Button>
        }
      />

      <SearchBox defaultValue={params.q} suggestions={params.q ? undefined : POPULAR_SEARCHES} />

      {!params.q && !activeCategory ? (
        <nav aria-label="Categories" className="-mx-1 overflow-x-auto pb-1">
          <ul className="flex gap-2 px-1">
            {categories.map((category) => (
              <li key={category.id} className="shrink-0">
                <Link
                  href={`/marketplace?category=${category.slug}`}
                  className="flex w-32 flex-col items-center gap-2 rounded-xl border border-border bg-surface p-3 text-center transition-colors hover:border-brand-300 hover:bg-brand-50/50"
                >
                  <CategoryIcon
                    name={category.iconName ?? "other"}
                    className="size-5 text-brand-700"
                  />
                  <span className="text-xs font-medium leading-tight">{category.name}</span>
                  <span className="text-[0.6875rem] text-foreground-subtle">
                    {category.productCount}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {catalogueEntry && catalogueEntry.subcategories.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {catalogueEntry.subcategories.map((subcategory) => (
            <Link
              key={subcategory.slug}
              href={`/marketplace?category=${subcategory.slug}`}
              className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-foreground-muted transition-colors hover:border-brand-300 hover:text-brand-700"
            >
              {subcategory.name}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <FilterPanel
            params={params}
            categories={categories}
            provinces={provinces}
            resultCount={results.totalCount}
          />
        </div>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-foreground-muted" aria-live="polite">
              {results.totalCount === 0
                ? "No products found"
                : `${results.totalCount} ${results.totalCount === 1 ? "product" : "products"}`}
              {params.q ? (
                <>
                  {" for "}
                  <span className="font-medium text-foreground">“{params.q}”</span>
                </>
              ) : null}
            </p>
            <SortSelect sort={params.sort} />
          </div>

          {params.sort === "nearest" && !params.provinceId ? (
            <p className="rounded-lg border border-gold-200 bg-gold-50 px-3 py-2 text-xs text-gold-800">
              Choose a province to sort by distance. Distances are estimated between district
              centres.
            </p>
          ) : null}

          {results.items.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="Nothing matched that search"
              description="Try a shorter search term, widen the price range, or clear a filter. New suppliers are added regularly."
              action={
                <Button asChild>
                  <Link href="/marketplace">Clear filters</Link>
                </Button>
              }
              secondaryAction={
                <Button asChild variant="outline">
                  <Link href="/marketplace/suppliers">Browse by supplier</Link>
                </Button>
              }
            />
          ) : (
            <>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {results.items.map((product) => (
                  <li key={product.id} className="min-w-0">
                    <ProductCard product={product} />
                  </li>
                ))}
              </ul>

              <Pagination
                page={results.page}
                totalPages={results.totalPages}
                totalCount={results.totalCount}
                pageSize={results.pageSize}
                itemNoun="product"
                buildHref={(page) => buildSearchHref(params, { page })}
              />
            </>
          )}

          <p className="text-xs text-foreground-subtle">
            <Badge tone="neutral" size="sm" className="mr-1.5">
              Demo listing
            </Badge>
            marks seeded example data with indicative prices, not live market prices.
          </p>
        </div>
      </div>
    </div>
  );
}
