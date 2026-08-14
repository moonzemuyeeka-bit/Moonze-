import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-55 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-brand-700 text-white shadow-sm hover:bg-brand-800 active:bg-brand-900",
        accent: "bg-gold-500 text-ink-950 shadow-sm hover:bg-gold-400 active:bg-gold-600",
        secondary: "bg-brand-50 text-brand-800 hover:bg-brand-100 active:bg-brand-200",
        outline:
          "border border-border-strong bg-surface text-foreground hover:bg-surface-muted active:bg-ink-100",
        ghost: "text-foreground hover:bg-surface-muted active:bg-ink-100",
        danger: "bg-danger-500 text-white shadow-sm hover:bg-danger-700",
        link: "text-brand-700 underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-3 text-sm [&_svg]:size-4",
        md: "h-11 px-4 text-sm [&_svg]:size-4",
        lg: "h-12 px-6 text-base [&_svg]:size-5",
        icon: "size-11 [&_svg]:size-5",
        "icon-sm": "size-9 [&_svg]:size-4",
      },
      block: {
        true: "w-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Shows a spinner and blocks interaction. */
    loading?: boolean;
    loadingText?: string;
  };

/**
 * The one button in the product.
 *
 * `loading` disables the control and swaps in a spinner while announcing the
 * busy state, so a slow server action can never be double-submitted and a
 * screen-reader user is told what is happening.
 */
export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  loading = false,
  loadingText,
  disabled,
  children,
  ...props
}: ButtonProps) {
  if (asChild) {
    return (
      <Slot className={cn(buttonVariants({ variant, size, block }), className)} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 aria-hidden className="animate-spin" />
          <span>{loadingText ?? children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

export { buttonVariants };
