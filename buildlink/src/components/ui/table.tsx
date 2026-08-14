import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Data table primitives.
 *
 * The wrapper scrolls horizontally and is focusable with a label, so a wide
 * admin table stays reachable by keyboard on a narrow screen instead of being
 * clipped. Where a table would be unreadable on a phone, callers render the
 * card list variant instead of shrinking the table.
 */

export function TableWrapper({
  className,
  label,
  ...props
}: React.ComponentProps<"div"> & { label: string }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn(
        "w-full overflow-x-auto rounded-xl border border-border bg-surface",
        className,
      )}
      {...props}
    />
  );
}

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return <table className={cn("w-full caption-bottom text-sm", className)} {...props} />;
}

export function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("bg-surface-muted", className)} {...props} />;
}

export function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn("divide-y divide-border", className)} {...props} />;
}

export function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr className={cn("transition-colors hover:bg-surface-muted/60", className)} {...props} />;
}

export function TableHead({
  className,
  numeric,
  ...props
}: React.ComponentProps<"th"> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-foreground-subtle",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  numeric,
  ...props
}: React.ComponentProps<"td"> & { numeric?: boolean }) {
  return (
    <td
      className={cn("px-4 py-3 align-middle text-foreground", numeric && "tabular text-right", className)}
      {...props}
    />
  );
}

export function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return <caption className={cn("px-4 py-3 text-xs text-foreground-muted", className)} {...props} />;
}
