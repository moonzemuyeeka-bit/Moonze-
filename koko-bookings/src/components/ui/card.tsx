import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  interactive = false,
  selected = false,
  ...props
}: React.ComponentProps<"div"> & { interactive?: boolean; selected?: boolean }) {
  return (
    <div
      data-selected={selected || undefined}
      className={cn(
        "surface rounded-3xl",
        interactive &&
          "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card",
        selected && "border-blush-400 ring-2 ring-blush-300/70",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 p-5 pb-3 sm:p-6 sm:pb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn("font-display text-lg leading-tight text-ink sm:text-xl", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-ink-soft", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5 pt-0 sm:p-6 sm:pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-3 border-t border-line p-5 sm:p-6", className)}
      {...props}
    />
  );
}
