import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("skeleton rounded-2xl", className)} aria-hidden {...props} />;
}

/** Announced loading state, e.g. "Loading calendar…". */
export function LoadingRow({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn("flex items-center gap-2 text-sm text-ink-soft", className)}
    >
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}
    </p>
  );
}

export function SkeletonGrid({
  count = 6,
  className,
  itemClassName,
}: {
  count?: number;
  className?: string;
  itemClassName?: string;
}) {
  return (
    <div className={cn("grid gap-3", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className={cn("h-14", itemClassName)} />
      ))}
    </div>
  );
}
