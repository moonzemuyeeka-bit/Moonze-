import * as React from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-md border border-border-strong bg-surface px-3 text-base text-foreground shadow-sm transition-colors placeholder:text-foreground-subtle focus-visible:border-brand-600 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-foreground-subtle aria-[invalid=true]:border-danger-500";

export function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return <input type={type} className={cn(fieldBase, "h-11", className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }: React.ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(fieldBase, "py-2.5", className)} {...props} />;
}

/**
 * Native select, styled to match. A native control is deliberate on mobile: the
 * OS picker is faster and more accessible than any custom listbox, and these
 * forms are mostly filled in on phones.
 */
export function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        fieldBase,
        "h-11 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%235f6970%22 stroke-width=%222%22 stroke-linecap=%22round%22><path d=%22M6 9l6 6 6-6%22/></svg>')] bg-[length:1.15rem] bg-[right_0.65rem_center] bg-no-repeat pr-9",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export { fieldBase };
