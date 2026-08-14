"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-55 active:translate-y-px [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-linear-to-br from-blush-500 to-blush-600 text-white shadow-soft hover:from-blush-600 hover:to-blush-700 hover:shadow-card",
        secondary:
          "bg-white text-ink border border-line shadow-soft hover:border-blush-300 hover:text-blush-700",
        outline:
          "border border-blush-300 text-blush-700 hover:bg-blush-50",
        ghost: "text-ink-soft hover:bg-blush-50 hover:text-blush-700",
        subtle: "bg-blush-100 text-blush-800 hover:bg-blush-200",
        danger:
          "bg-rose-alert-500 text-white shadow-soft hover:bg-rose-alert-700",
        link: "text-blush-700 underline underline-offset-4 hover:text-blush-800",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-13 px-7 text-base",
        icon: "size-10",
      },
      full: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", full: false },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
    loadingText?: string;
  };

/** Touch targets are at least 36–52px tall so the flow works on a phone. */
export function Button({
  className,
  variant,
  size,
  full,
  asChild = false,
  loading = false,
  loadingText,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      className={cn(buttonVariants({ variant, size, full }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          <span>{loadingText ?? children}</span>
        </>
      ) : (
        children
      )}
    </Component>
  );
}

export { buttonVariants };
