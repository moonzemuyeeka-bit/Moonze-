import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, ImageOff, Package, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/feedback";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { formatDate } from "@/components/ui/timeline";
import { requirePageSupplier } from "@/lib/auth/guards";
import {
  listSupplierProducts,
  SUPPLIER_PRODUCTS_PAGE_SIZE,
  type SupplierProductFilter,
} from "@/server/suppliers/queries";
import { formatZmw } from "@/lib/money";
import { PRODUCT_STATUS_LABELS, PRODUCT_STATUS_TONES, PRODUCT_UNIT_SHORT } from "@/lib/labels";
import { StockDialog } from "./product-actions";
import type { ProductUnit } from "@prisma/client";

export const metadata: Metadata = {
  title: "Products and stock",
  description: "Your listings, their prices and what you have on hand.",
};

const FILTERS: Array<{ key: SupplierProductFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "attention", label: "Needs attention" },
  { key: "archived", label: "Archived" },
];

function isFilter(value: string): value is SupplierProductFilter {
  return FILTERS.some((filter) => filter.key === value);
}

/**
 * The supplier's catalogue.
 *
 * Stock is editable straight from the list. A supplier who has just sold twenty
 * bags at the counter will update the figure only if it takes one tap, and stock
 * nobody trusts is worse than no stock figure at all.
 */
export default async function SupplierProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supplier } = await requirePageSupplier("/supplier/products");
  const params = await searchParams;

  const rawFilter = typeof params.filter === "string" ? params.filter : "all";
  const filter: SupplierProductFilter = isFilter(rawFilter) ? rawFilter : "all";
  const search = typeof params.q === "string" ? params.q.trim() : "";
  const page = parsePage(params.page);

  const { products, total, pageCount } = await listSupplierProducts(supplier.id, {
    filter,
    search: search || undefined,
    page,
  });

  function hrefFor(next: { filter?: SupplierProductFilter; page?: number }): string {
    const query = new URLSearchParams();
    const targetFilter = next.filter ?? filter;
    if (targetFilter !== "all") query.set("filter", targetFilter);
    if (search) query.set("q", search);
    if (next.page && next.page > 1) query.set("page", String(next.page));
    const suffix = query.toString();
    return suffix ? `/supplier/products?${suffix}` : "/supplier/products";
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Products and stock"
        description="Everything you sell on BuildLink. Keep prices and stock honest and your listings will keep converting."
        actions={
          <Button asChild>
            <Link href="/supplier/products/new">
              <Plus />
              Add a product
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Filter listings" className="flex flex-wrap gap-2">
          {FILTERS.map((option) => (
            <Button
              key={option.key}
              asChild
              size="sm"
              variant={filter === option.key ? "secondary" : "ghost"}
            >
              <Link href={hrefFor({ filter: option.key, page: 1 })}>{option.label}</Link>
            </Button>
          ))}
        </nav>

        <form action="/supplier/products" className="flex items-center gap-2">
          {filter === "all" ? null : <input type="hidden" name="filter" value={filter} />}
          <label htmlFor="product-search" className="sr-only">
            Search your listings
          </label>
          <Input
            id="product-search"
            name="q"
            type="search"
            defaultValue={search}
            placeholder="Search by name or brand"
            className="h-9 sm:w-64"
          />
          <Button type="submit" size="sm" variant="outline">
            <Search />
            Search
          </Button>
        </form>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title={
            search
              ? `Nothing matches “${search}”`
              : filter === "all"
                ? "You have no listings yet"
                : "Nothing in this view"
          }
          description={
            search
              ? "Try a shorter search, or clear it to see everything."
              : filter === "all"
                ? "A listing needs a name, a category, a price per unit and the quantity you hold. Adding photographs roughly doubles the enquiries a listing gets."
                : "Try another filter."
          }
          action={
            <Button asChild>
              <Link href={search || filter !== "all" ? "/supplier/products" : "/supplier/products/new"}>
                {search || filter !== "all" ? "Show all listings" : "Add your first product"}
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {products.map((product) => (
            <li key={product.id}>
              <Card>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                  <Link
                    href={`/supplier/products/${product.id}`}
                    className="flex min-w-0 flex-1 gap-3"
                  >
                    <span className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-muted">
                      {product.imageUrl ? (
                        <Image
                          src={product.imageUrl}
                          alt=""
                          fill
                          sizes="4rem"
                          className="object-cover"
                        />
                      ) : (
                        <span className="flex size-full items-center justify-center text-ink-300">
                          <ImageOff aria-hidden className="size-5" />
                        </span>
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {product.name}
                        </span>
                        <Badge tone={PRODUCT_STATUS_TONES[product.status]} size="sm">
                          {PRODUCT_STATUS_LABELS[product.status]}
                        </Badge>
                        {product.isOutOfStock ? (
                          <Badge tone="danger" size="sm">
                            Out of stock
                          </Badge>
                        ) : product.isLowStock ? (
                          <Badge tone="warning" size="sm">
                            Low stock
                          </Badge>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-foreground-muted">
                        {product.categoryName}
                        {product.brand ? ` · ${product.brand}` : ""} · updated{" "}
                        {formatDate(product.updatedAt)}
                      </span>
                      <span className="mt-1 block text-xs text-foreground-muted">
                        {product.viewCount} view{product.viewCount === 1 ? "" : "s"} ·{" "}
                        {product.purchaseCount} sold · minimum order{" "}
                        {product.minimumOrderQuantity}
                      </span>
                      {product.status === "REJECTED" && product.rejectionReason ? (
                        <span className="mt-1 flex items-start gap-1.5 text-xs text-danger-700">
                          <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                          {product.rejectionReason}
                        </span>
                      ) : null}
                    </span>
                  </Link>

                  <div className="flex shrink-0 items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-start sm:text-right">
                    <div>
                      <p className="tabular text-sm font-semibold">
                        {formatZmw(product.priceMinor)}
                        <span className="font-normal text-foreground-muted">
                          {" "}
                          / {PRODUCT_UNIT_SHORT[product.unit as ProductUnit]}
                        </span>
                      </p>
                      <p className="text-xs text-foreground-muted">
                        {product.stockQuantity} in stock
                      </p>
                    </div>
                    <StockDialog
                      productId={product.id}
                      productName={product.name}
                      stockQuantity={product.stockQuantity}
                      unit={product.unit as ProductUnit}
                    />
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {products.length > 0 ? (
        <Pagination
          page={page}
          totalPages={pageCount}
          totalCount={total}
          pageSize={SUPPLIER_PRODUCTS_PAGE_SIZE}
          itemNoun="listing"
          buildHref={(target) => hrefFor({ page: target })}
        />
      ) : null}
    </div>
  );
}
