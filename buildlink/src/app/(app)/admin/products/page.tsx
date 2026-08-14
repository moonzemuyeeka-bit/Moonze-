import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ImageOff, Package, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/feedback";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { formatDate } from "@/components/ui/timeline";
import { requirePageAdmin } from "@/lib/auth/guards";
import {
  ADMIN_PAGE_SIZE,
  countProductsByStatus,
  listProductsForAdmin,
} from "@/server/admin/queries";
import { formatZmw } from "@/lib/money";
import {
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUS_TONES,
  PRODUCT_UNIT_SHORT,
} from "@/lib/labels";
import type { ProductStatus, ProductUnit } from "@prisma/client";
import { ProductModerationForms } from "./product-moderation";

export const metadata: Metadata = {
  title: "Product moderation",
  description: "Listings waiting for approval, and everything already on the marketplace.",
};

const FILTERS = [
  { key: "PENDING_APPROVAL", label: "Awaiting approval" },
  { key: "ACTIVE", label: "Live" },
  { key: "REJECTED", label: "Rejected" },
  { key: "DRAFT", label: "Drafts" },
  { key: "INACTIVE", label: "Hidden" },
  { key: "ARCHIVED", label: "Archived" },
  { key: "", label: "Everything" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function asFilter(value: string | undefined): FilterKey {
  const match = FILTERS.find((filter) => filter.key === value);
  return match ? match.key : "PENDING_APPROVAL";
}

/**
 * The moderation queue.
 *
 * Oldest first inside the queue, because a supplier who submitted on Monday
 * should not wait behind one who submitted this morning. Each row carries the
 * photograph, the price and the unit together — the three things a bad listing
 * usually gets wrong.
 */
export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageAdmin("/admin/products");
  const params = await searchParams;

  const filter = asFilter(typeof params.status === "string" ? params.status : undefined);
  const search = typeof params.q === "string" ? params.q.trim() : "";
  const page = parsePage(params.page);

  const [{ products, total, pageCount }, counts] = await Promise.all([
    listProductsForAdmin({
      status: filter === "" ? undefined : (filter as ProductStatus),
      search: search || undefined,
      page,
    }),
    countProductsByStatus(),
  ]);

  function hrefFor(next: { status?: FilterKey; page?: number }): string {
    const query = new URLSearchParams();
    const targetStatus = next.status ?? filter;
    if (targetStatus) query.set("status", targetStatus);
    if (search) query.set("q", search);
    if (next.page && next.page > 1) query.set("page", String(next.page));
    const suffix = query.toString();
    return suffix ? `/admin/products?${suffix}` : "/admin/products";
  }

  const pending = counts.PENDING_APPROVAL ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Product moderation"
        description={
          pending === 0
            ? "Nothing is waiting for approval."
            : `${pending} listing${pending === 1 ? "" : "s"} waiting for a decision.`
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Filter listings" className="flex flex-wrap gap-2">
          {FILTERS.map((option) => (
            <Button
              key={option.key || "all"}
              asChild
              size="sm"
              variant={filter === option.key ? "secondary" : "ghost"}
            >
              <Link href={hrefFor({ status: option.key, page: 1 })}>
                {option.label}
                {option.key && counts[option.key as ProductStatus]
                  ? ` (${counts[option.key as ProductStatus]})`
                  : ""}
              </Link>
            </Button>
          ))}
        </nav>

        <form action="/admin/products" className="flex items-center gap-2">
          {filter ? <input type="hidden" name="status" value={filter} /> : null}
          <label htmlFor="product-search" className="sr-only">
            Search listings
          </label>
          <Input
            id="product-search"
            name="q"
            type="search"
            defaultValue={search}
            placeholder="Product, brand or supplier"
            className="h-9 sm:w-64"
          />
          <Button type="submit" size="sm" variant="outline">
            <Search aria-hidden />
            Search
          </Button>
        </form>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title={
            filter === "PENDING_APPROVAL"
              ? "The moderation queue is clear"
              : "No listing matches this view"
          }
          description={
            filter === "PENDING_APPROVAL"
              ? "Every listing suppliers have submitted has been decided. New submissions appear here."
              : "Try a different status, or search for the product or supplier name."
          }
          action={
            <Button asChild variant="outline">
              <Link href={hrefFor({ status: "", page: 1 })}>Show every listing</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {products.map((product) => (
            <li key={product.id}>
              <Card>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
                  <span className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-muted">
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        fill
                        sizes="5rem"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex size-full flex-col items-center justify-center gap-1 text-ink-400">
                        <ImageOff aria-hidden className="size-4" />
                        <span className="text-[0.625rem]">No photo</span>
                      </span>
                    )}
                  </span>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                          <Link
                            href={`/marketplace/products/${product.id}`}
                            className="hover:text-brand-700 hover:underline"
                          >
                            {product.name}
                          </Link>
                          {product.isDemo ? (
                            <Badge tone="neutral" size="sm">
                              Demo
                            </Badge>
                          ) : null}
                        </p>
                        <p className="text-xs text-foreground-muted">
                          {product.categoryName}
                          {product.brand ? ` · ${product.brand}` : ""} ·{" "}
                          <Link
                            href={`/admin/suppliers/${product.supplierId}`}
                            className="hover:underline"
                          >
                            {product.supplierName}
                          </Link>
                          {product.supplierVerified ? "" : " (unverified business)"}
                        </p>
                      </div>
                      <Badge tone={PRODUCT_STATUS_TONES[product.status]}>
                        {PRODUCT_STATUS_LABELS[product.status]}
                      </Badge>
                    </div>

                    <p className="text-sm">
                      <span className="tabular font-semibold">{formatZmw(product.priceMinor)}</span>
                      <span className="text-foreground-muted">
                        {" "}
                        / {PRODUCT_UNIT_SHORT[product.unit as ProductUnit]} ·{" "}
                        {product.stockQuantity} in stock · updated{" "}
                        {formatDate(product.updatedAt)}
                      </span>
                    </p>

                    {product.rejectionReason ? (
                      <p className="text-xs text-danger-700">
                        <span className="font-medium">Previously rejected: </span>
                        {product.rejectionReason}
                      </p>
                    ) : null}

                    <ProductModerationForms
                      productId={product.id}
                      productName={product.name}
                      canApprove={product.status !== "ACTIVE"}
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
          pageSize={ADMIN_PAGE_SIZE}
          itemNoun="listing"
          buildHref={(target) => hrefFor({ page: target })}
        />
      ) : null}
    </div>
  );
}
