import * as React from "react";
import { cn, initialsFrom } from "@/lib/utils";

/**
 * Identity avatar.
 *
 * Deliberately not the Radix avatar: BuildLink shows initials on a brand tint
 * far more often than an uploaded image, and a plain element avoids shipping a
 * client component for what is static output.
 */
export function Avatar({
  name,
  src,
  size = "md",
  className,
  square = false,
}: {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  square?: boolean;
}) {
  const dimensions = {
    sm: "size-8 text-xs",
    md: "size-10 text-sm",
    lg: "size-14 text-base",
    xl: "size-20 text-xl",
  }[size];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden border border-border bg-brand-50 font-semibold uppercase text-brand-800",
        square ? "rounded-lg" : "rounded-full",
        dimensions,
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatars are already small, stored assets; the optimiser adds no value and would need a remote pattern per bucket
        <img src={src} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <span aria-hidden>{initialsFrom(name)}</span>
      )}
    </span>
  );
}
