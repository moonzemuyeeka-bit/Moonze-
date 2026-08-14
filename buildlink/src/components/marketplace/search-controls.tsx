"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Filter, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { CheckboxField } from "@/components/ui/controls";
import { Badge } from "@/components/ui/badge";
import { PRODUCT_SORT_LABELS, PRODUCT_SORTS } from "@/lib/validation/marketplace";
import type { ProductSearchParams } from "@/lib/validation/marketplace";
import type { CategoryOption, ProvinceOption } from "@/server/reference/queries";

/**
 * Marketplace search and filter controls.
 *
 * All state lives in the URL, so these are thin: they read the current query
 * string and navigate to a new one. That keeps results shareable and lets the
 * server do the filtering, which is the only place it can be trusted.
 */

function withParam(
  params: URLSearchParams,
  key: string,
  value: string | null,
): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  if (value === null || value === "") next.delete(key);
  else next.set(key, value);
  // Any filter change invalidates the page number.
  next.delete("page");
  return next;
}

export function SearchBox({
  basePath = "/marketplace",
  defaultValue,
  placeholder = "Search cement, roofing sheets, tiles…",
  suggestions,
}: {
  basePath?: string;
  defaultValue?: string | null;
  placeholder?: string;
  suggestions?: readonly string[];
}) {
  const searchParams = useSearchParams();
  const preserved = new URLSearchParams(searchParams.toString());
  preserved.delete("q");
  preserved.delete("page");

  return (
    <div className="space-y-2">
      <form action={basePath} className="flex gap-2" role="search">
        {[...preserved.entries()].map(([key, value]) => (
          <input key={`${key}-${value}`} type="hidden" name={key} value={value} />
        ))}
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-subtle"
          />
          <Input
            type="search"
            name="q"
            defaultValue={defaultValue ?? ""}
            placeholder={placeholder}
            aria-label="Search materials"
            className="pl-9"
          />
        </div>
        <Button type="submit">Search</Button>
      </form>

      {suggestions && suggestions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-foreground-subtle">Popular:</span>
          {suggestions.map((term) => (
            <Link
              key={term}
              href={`${basePath}?q=${encodeURIComponent(term)}`}
              className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-foreground-muted transition-colors hover:border-brand-300 hover:text-brand-700"
            >
              {term}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SortSelect({ sort }: { sort: ProductSearchParams["sort"] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="whitespace-nowrap text-foreground-muted">Sort by</span>
      <NativeSelect
        value={sort}
        aria-label="Sort results"
        onChange={(event) =>
          router.push(`?${withParam(searchParams, "sort", event.target.value).toString()}`)
        }
        className="h-9 w-auto min-w-[11rem] py-0 text-sm"
      >
        {PRODUCT_SORTS.map((value) => (
          <option key={value} value={value}>
            {PRODUCT_SORT_LABELS[value]}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}

/**
 * Filter panel.
 *
 * Rendered inline on desktop and behind a disclosure on mobile: filters matter,
 * but not more than the results themselves on a 375px screen.
 */
export function FilterPanel({
  params,
  categories,
  provinces,
  resultCount,
}: {
  params: ProductSearchParams;
  categories: CategoryOption[];
  provinces: ProvinceOption[];
  resultCount: number;
}) {
  const [open, setOpen] = React.useState(false);
  const activeCount = countActiveFilters(params);

  return (
    <>
      <div className="lg:hidden">
        <Button
          variant="outline"
          onClick={() => setOpen((previous) => !previous)}
          aria-expanded={open}
          aria-controls="marketplace-filters"
          block
        >
          <SlidersHorizontal />
          Filters
          {activeCount > 0 ? (
            <Badge tone="accent" size="sm">
              {activeCount}
            </Badge>
          ) : null}
        </Button>
      </div>

      <div
        id="marketplace-filters"
        className={open ? "mt-3 lg:mt-0" : "hidden lg:block"}
        role="group"
        aria-label="Filter results"
      >
        <FilterForm
          params={params}
          categories={categories}
          provinces={provinces}
          resultCount={resultCount}
        />
      </div>
    </>
  );
}

function FilterForm({
  params,
  categories,
  provinces,
  resultCount,
}: {
  params: ProductSearchParams;
  categories: CategoryOption[];
  provinces: ProvinceOption[];
  resultCount: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [minPrice, setMinPrice] = React.useState(
    params.minPriceMinor !== null ? String(params.minPriceMinor / 100) : "",
  );
  const [maxPrice, setMaxPrice] = React.useState(
    params.maxPriceMinor !== null ? String(params.maxPriceMinor / 100) : "",
  );

  const districts =
    provinces.find((province) => province.id === params.provinceId)?.districts ?? [];

  function go(key: string, value: string | null) {
    router.push(`?${withParam(searchParams, key, value).toString()}`);
  }

  function applyPrice() {
    const next = new URLSearchParams(searchParams.toString());
    if (minPrice.trim()) next.set("min", minPrice.trim());
    else next.delete("min");
    if (maxPrice.trim()) next.set("max", maxPrice.trim());
    else next.delete("max");
    next.delete("page");
    router.push(`?${next.toString()}`);
  }

  return (
    <div className="space-y-5 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Filter aria-hidden className="size-4" />
          Filters
        </p>
        {countActiveFilters(params) > 0 ? (
          <Button variant="link" size="sm" className="h-auto p-0" asChild>
            <Link href={params.q ? `/marketplace?q=${encodeURIComponent(params.q)}` : "/marketplace"}>
              <X aria-hidden />
              Clear all
            </Link>
          </Button>
        ) : null}
      </div>

      <Field name="filter-category" label="Category">
        {(control) => (
          <NativeSelect
            {...control}
            value={params.categorySlug ?? ""}
            onChange={(event) => go("category", event.target.value || null)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name} ({category.productCount})
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <Field name="filter-province" label="Province">
        {(control) => (
          <NativeSelect
            {...control}
            value={params.provinceId ?? ""}
            onChange={(event) => {
              const next = withParam(searchParams, "province", event.target.value || null);
              next.delete("district");
              router.push(`?${next.toString()}`);
            }}
          >
            <option value="">Anywhere in Zambia</option>
            {provinces.map((province) => (
              <option key={province.id} value={province.id}>
                {province.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      {districts.length > 0 ? (
        <Field name="filter-district" label="District">
          {(control) => (
            <NativeSelect
              {...control}
              value={params.districtId ?? ""}
              onChange={(event) => go("district", event.target.value || null)}
            >
              <option value="">All districts</option>
              {districts.map((district) => (
                <option key={district.id} value={district.id}>
                  {district.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
      ) : null}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">Price per unit (ZMW)</legend>
        <div className="flex items-center gap-2">
          <Input
            inputMode="decimal"
            placeholder="Min"
            aria-label="Minimum price"
            value={minPrice}
            onChange={(event) => setMinPrice(event.target.value)}
          />
          <span aria-hidden className="text-foreground-subtle">
            –
          </span>
          <Input
            inputMode="decimal"
            placeholder="Max"
            aria-label="Maximum price"
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" onClick={applyPrice} block>
          Apply price
        </Button>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-foreground">Only show</legend>
        <CheckboxField
          id="filter-verified"
          label="Verified suppliers"
          description="BuildLink has checked their registration documents."
          checked={params.verifiedOnly}
          onCheckedChange={(checked) => go("verified", checked === true ? "1" : null)}
        />
        <CheckboxField
          id="filter-stock"
          label="In stock now"
          checked={params.inStockOnly}
          onCheckedChange={(checked) => go("stock", checked === true ? "1" : null)}
        />
        <CheckboxField
          id="filter-delivery"
          label="Delivery available"
          checked={params.deliveryOnly}
          onCheckedChange={(checked) => go("delivery", checked === true ? "1" : null)}
        />
      </fieldset>

      <p aria-live="polite" className="text-xs text-foreground-muted">
        {resultCount} {resultCount === 1 ? "product matches" : "products match"} these filters.
      </p>
    </div>
  );
}

function countActiveFilters(params: ProductSearchParams): number {
  return [
    params.categorySlug !== null,
    params.provinceId !== null,
    params.districtId !== null,
    params.supplierSlug !== null,
    params.minPriceMinor !== null,
    params.maxPriceMinor !== null,
    params.verifiedOnly,
    params.inStockOnly,
    params.deliveryOnly,
  ].filter(Boolean).length;
}
