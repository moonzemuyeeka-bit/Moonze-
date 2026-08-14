import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Link-based pagination.
 *
 * Server-rendered anchors rather than client state: the page is shareable, the
 * back button works, and no product data has to be shipped to the browser to
 * paginate. Large catalogues are never loaded wholesale.
 */
export function Pagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  buildHref,
  className,
  itemNoun = "result",
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  buildHref: (page: number) => string;
  className?: string;
  itemNoun?: string;
}) {
  if (totalPages <= 1) {
    return totalCount > 0 ? (
      <p className={cn("text-xs text-foreground-muted", className)}>
        {totalCount} {itemNoun}
        {totalCount === 1 ? "" : "s"}
      </p>
    ) : null;
  }

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(totalCount, page * pageSize);
  const pages = pageWindow(page, totalPages);

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}
    >
      <p className="text-xs text-foreground-muted">
        Showing <span className="font-medium text-foreground">{first}</span>–
        <span className="font-medium text-foreground">{last}</span> of{" "}
        <span className="font-medium text-foreground">{totalCount}</span> {itemNoun}
        {totalCount === 1 ? "" : "s"}
      </p>

      <ul className="flex items-center gap-1">
        <li>
          <PaginationLink
            href={buildHref(page - 1)}
            disabled={page <= 1}
            label="Previous page"
            icon
          >
            <ChevronLeft aria-hidden className="size-4" />
          </PaginationLink>
        </li>

        {pages.map((entry, index) =>
          entry === "gap" ? (
            <li key={`gap-${index}`} aria-hidden className="px-1 text-foreground-subtle">
              …
            </li>
          ) : (
            <li key={entry}>
              <PaginationLink
                href={buildHref(entry)}
                current={entry === page}
                label={`Page ${entry}`}
              >
                {entry}
              </PaginationLink>
            </li>
          ),
        )}

        <li>
          <PaginationLink
            href={buildHref(page + 1)}
            disabled={page >= totalPages}
            label="Next page"
            icon
          >
            <ChevronRight aria-hidden className="size-4" />
          </PaginationLink>
        </li>
      </ul>
    </nav>
  );
}

function PaginationLink({
  href,
  children,
  current,
  disabled,
  label,
  icon,
}: {
  href: string;
  children: React.ReactNode;
  current?: boolean;
  disabled?: boolean;
  label: string;
  icon?: boolean;
}) {
  const classes = cn(
    "inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-sm font-medium transition-colors",
    current
      ? "border-brand-700 bg-brand-700 text-white"
      : "border-border bg-surface text-foreground hover:bg-surface-muted",
    disabled && "pointer-events-none opacity-40",
    icon && "px-0",
  );

  if (disabled) {
    return (
      <span className={classes} aria-disabled="true" aria-label={label}>
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={classes}
      aria-label={label}
      aria-current={current ? "page" : undefined}
    >
      {children}
    </Link>
  );
}

/** Page numbers around the current page, with gaps for long ranges. */
function pageWindow(page: number, totalPages: number): Array<number | "gap"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const window = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  const sorted = [...window].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);

  const result: Array<number | "gap"> = [];
  let previous = 0;
  for (const value of sorted) {
    if (previous && value - previous > 1) result.push("gap");
    result.push(value);
    previous = value;
  }
  return result;
}

export const DEFAULT_PAGE_SIZE = 12;

/** Parses a `?page=` value into a safe 1-based page number. */
export function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 10_000) : 1;
}
