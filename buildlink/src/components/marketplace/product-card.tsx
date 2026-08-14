import Link from "next/link";
import Image from "next/image";
import { ImageOff, MapPin, ShieldCheck, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/ui/star-rating";
import { cn, formatDistanceKm } from "@/lib/utils";
import { formatZmw } from "@/lib/money";
import { PRODUCT_UNIT_SHORT } from "@/lib/labels";
import type { ProductListItem } from "@/server/marketplace/queries";

/**
 * Product tile.
 *
 * Price, unit and who is selling it are the three things a buyer compares, so
 * they are the three things always visible — supplier and verification included,
 * because in this market who you are buying from matters as much as the price.
 */
export function ProductCard({
  product,
  className,
}: {
  product: ProductListItem;
  className?: string;
}) {
  const outOfStock = product.stockQuantity <= 0;

  return (
    <article
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-card transition-shadow hover:shadow-card-hover",
        className,
      )}
    >
      <Link
        href={`/marketplace/products/${product.id}`}
        className="relative block aspect-4/3 overflow-hidden bg-surface-muted"
      >
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.imageAlt ?? product.name}
            fill
            sizes="(min-width: 1280px) 20rem, (min-width: 640px) 45vw, 90vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-ink-300">
            <ImageOff aria-hidden className="size-8" />
            <span className="sr-only">No photo provided</span>
          </span>
        )}

        <span className="absolute left-2 top-2 flex flex-wrap gap-1">
          {product.isDemo ? (
            <Badge tone="neutral" size="sm">
              Demo listing
            </Badge>
          ) : null}
          {outOfStock ? (
            <Badge tone="danger" size="sm">
              Out of stock
            </Badge>
          ) : null}
        </span>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <div className="min-w-0">
          <p className="text-xs text-foreground-subtle">{product.categoryName}</p>
          <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug">
            <Link
              href={`/marketplace/products/${product.id}`}
              className="hover:text-brand-700 hover:underline"
            >
              {product.name}
            </Link>
          </h3>
          {product.brand ? (
            <p className="mt-0.5 truncate text-xs text-foreground-muted">{product.brand}</p>
          ) : null}
        </div>

        <p className="tabular text-lg font-semibold leading-none text-foreground">
          {formatZmw(product.priceMinor)}
          <span className="ml-1 text-xs font-normal text-foreground-muted">
            / {PRODUCT_UNIT_SHORT[product.unit]}
          </span>
        </p>

        <div className="mt-auto space-y-1.5 border-t border-border pt-2.5">
          <p className="flex min-w-0 items-center gap-1 text-xs">
            <Link
              href={`/marketplace/suppliers/${product.supplier.slug}`}
              className="truncate font-medium text-foreground hover:text-brand-700 hover:underline"
            >
              {product.supplier.businessName}
            </Link>
            {product.supplier.verificationStatus === "VERIFIED" ? (
              <ShieldCheck
                aria-label="Verified supplier"
                className="size-3.5 shrink-0 text-brand-600"
              />
            ) : null}
          </p>

          <StarRating
            ratingBps={product.supplier.ratingAverageBps}
            reviewCount={product.supplier.ratingCount}
            size="sm"
          />

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground-muted">
            <span className="flex items-center gap-1">
              <MapPin aria-hidden className="size-3.5" />
              {product.supplier.districtName ?? product.supplier.provinceName}
            </span>
            {product.distanceKm !== null ? (
              <span>{formatDistanceKm(product.distanceKm)}</span>
            ) : null}
            {product.deliveryAvailable ? (
              <span className="flex items-center gap-1 text-brand-700">
                <Truck aria-hidden className="size-3.5" />
                Delivers
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
