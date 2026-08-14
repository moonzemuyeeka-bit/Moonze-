import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { BadgeTone } from "@/lib/labels";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral: "border-border bg-surface-muted text-foreground-muted",
        info: "border-info-500/20 bg-info-50 text-info-700",
        success: "border-success-500/20 bg-success-50 text-success-700",
        warning: "border-warning-500/20 bg-warning-50 text-warning-700",
        danger: "border-danger-500/20 bg-danger-50 text-danger-700",
        accent: "border-gold-500/25 bg-gold-50 text-gold-800",
      } satisfies Record<BadgeTone, string>,
      size: {
        sm: "px-2 py-0 text-[0.6875rem]",
        md: "px-2.5 py-0.5 text-xs",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

export type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}
