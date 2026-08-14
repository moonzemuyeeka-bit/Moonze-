import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRating, ratingFromBasisPoints } from "@/lib/money";

/**
 * Read-only star rating.
 *
 * The numeric value and review count are always rendered as text next to the
 * stars — the stars are decoration, the text is the information.
 */
export function StarRating({
  ratingBps,
  reviewCount,
  size = "md",
  className,
  showCount = true,
}: {
  ratingBps: number;
  reviewCount?: number;
  size?: "sm" | "md";
  className?: string;
  showCount?: boolean;
}) {
  const stars = ratingFromBasisPoints(ratingBps);
  const iconSize = size === "sm" ? "size-3.5" : "size-4";

  if (reviewCount === 0) {
    return (
      <span className={cn("text-xs text-foreground-subtle", className)}>No reviews yet</span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span aria-hidden className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((index) => {
          const filled = stars >= index - 0.25;
          const half = !filled && stars >= index - 0.75;
          return (
            <Star
              key={index}
              className={cn(
                iconSize,
                filled || half ? "text-gold-500" : "text-ink-300",
                filled ? "fill-gold-500" : half ? "fill-gold-200" : "fill-none",
              )}
            />
          );
        })}
      </span>
      <span
        className={cn(
          "tabular font-medium text-foreground",
          size === "sm" ? "text-xs" : "text-sm",
        )}
      >
        {formatRating(ratingBps)}
      </span>
      {showCount && reviewCount !== undefined ? (
        <span className={cn("text-foreground-muted", size === "sm" ? "text-xs" : "text-sm")}>
          ({reviewCount})
        </span>
      ) : null}
      <span className="sr-only">
        {formatRating(ratingBps)} out of 5
        {reviewCount !== undefined ? ` from ${reviewCount} reviews` : ""}
      </span>
    </span>
  );
}

/** Interactive 1-5 star input used in the review form. */
export function StarRatingInput({
  name,
  value,
  onChange,
  label,
  required,
}: {
  name: string;
  value: number;
  onChange: (value: number) => void;
  label: string;
  required?: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-medium text-foreground">
        {label}
        {required ? <span className="ml-0.5 text-danger-500">*</span> : null}
      </legend>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <label
            key={star}
            className="cursor-pointer rounded p-1 hover:bg-surface-muted"
            title={`${star} star${star === 1 ? "" : "s"}`}
          >
            <input
              type="radio"
              name={name}
              value={star}
              checked={value === star}
              onChange={() => onChange(star)}
              required={required}
              className="sr-only"
            />
            <Star
              className={cn(
                "size-7",
                value >= star ? "fill-gold-500 text-gold-500" : "fill-none text-ink-300",
              )}
            />
            <span className="sr-only">
              {star} star{star === 1 ? "" : "s"}
            </span>
          </label>
        ))}
        <span className="ml-2 text-sm text-foreground-muted">
          {value > 0 ? `${value} of 5` : "Not rated"}
        </span>
      </div>
    </fieldset>
  );
}
