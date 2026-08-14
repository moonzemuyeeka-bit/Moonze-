import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium [&_svg]:size-3.5",
  {
    variants: {
      tone: {
        neutral: "border-line bg-white text-ink-soft",
        brand: "border-blush-200 bg-blush-50 text-blush-700",
        success: "border-mint-200 bg-mint-50 text-mint-700",
        warning: "border-amber-soft-200 bg-amber-soft-50 text-amber-soft-700",
        danger: "border-rose-alert-200 bg-rose-alert-50 text-rose-alert-700",
        muted: "border-line bg-blush-50/60 text-ink-muted",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { badgeVariants };
