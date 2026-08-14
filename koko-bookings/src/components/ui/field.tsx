import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function Label({
  className,
  required,
  children,
  ...props
}: React.ComponentProps<"label"> & { required?: boolean }) {
  return (
    <label className={cn("text-sm font-medium text-ink", className)} {...props}>
      {children}
      {required ? (
        <span className="ml-1 text-blush-600" aria-hidden>
          *
        </span>
      ) : null}
    </label>
  );
}

const controlClasses =
  "w-full rounded-2xl border border-line bg-white px-4 text-base text-ink placeholder:text-ink-muted/70 transition-colors focus:border-blush-400 focus:outline-none focus:ring-4 focus:ring-blush-300/25 disabled:bg-blush-50/60 disabled:text-ink-muted aria-[invalid=true]:border-rose-alert-500 aria-[invalid=true]:ring-rose-alert-500/15";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(controlClasses, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(controlClasses, "min-h-24 py-3", className)} {...props} />;
}

/**
 * A native `<select>`: fully accessible, and on a phone it opens the platform
 * picker, which beats any custom dropdown.
 */
export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        controlClasses,
        "h-12 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%238b8189%22 stroke-width=%222%22><path d=%22M6 9l6 6 6-6%22/></svg>')] bg-[length:18px_18px] bg-[right_1rem_center] bg-no-repeat pr-11",
        className,
      )}
      {...props}
    />
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-start gap-1.5 text-sm text-rose-alert-700" role="alert">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}

export function FieldHint({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-xs text-ink-muted", className)} {...props} />;
}

/** Label + control + hint/error, wired together for screen readers. */
export function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {children}
      {hint && !error ? <FieldHint>{hint}</FieldHint> : null}
      <FieldError message={error} />
    </div>
  );
}
