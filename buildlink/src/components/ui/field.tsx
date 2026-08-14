import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type FieldControlProps = {
  id: string;
  name: string;
  required?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

export type FieldProps = {
  name: string;
  label: string;
  /** Helper text rendered under the label and wired up via aria-describedby. */
  hint?: React.ReactNode;
  error?: string | string[];
  required?: boolean;
  className?: string;
  labelSuffix?: React.ReactNode;
  children: (control: FieldControlProps) => React.ReactNode;
};

/**
 * Accessible form field wrapper.
 *
 * Uses a render prop so the label, hint and error are always wired to the
 * control with matching `id` / `aria-describedby` / `aria-invalid`. Getting this
 * right once here is why every form in the product announces its errors
 * correctly to a screen reader.
 */
export function Field({
  name,
  label,
  hint,
  error,
  required,
  className,
  labelSuffix,
  children,
}: FieldProps) {
  const messages = Array.isArray(error) ? error : error ? [error] : [];
  const hasError = messages.length > 0;
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = hasError ? `${name}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={name} className="text-sm font-medium text-foreground">
          {label}
          {required ? (
            <span className="ml-0.5 text-danger-500" aria-hidden>
              *
            </span>
          ) : null}
          {required ? <span className="sr-only"> (required)</span> : null}
        </label>
        {labelSuffix}
      </div>

      {hint ? (
        <p id={hintId} className="text-xs text-foreground-muted">
          {hint}
        </p>
      ) : null}

      {children({
        id: name,
        name,
        required,
        "aria-describedby": describedBy,
        "aria-invalid": hasError || undefined,
      })}

      {hasError ? (
        <p id={errorId} className="flex items-start gap-1.5 text-xs text-danger-700">
          <AlertCircle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span>{messages.join(" ")}</span>
        </p>
      ) : null}
    </div>
  );
}

/** Row of related fields that stack on mobile and sit side by side on tablet up. */
export function FieldRow({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid gap-4 sm:grid-cols-2", className)} {...props} />;
}

export function FieldSet({
  legend,
  hint,
  error,
  className,
  children,
}: {
  legend: string;
  hint?: React.ReactNode;
  error?: string | string[];
  className?: string;
  children: React.ReactNode;
}) {
  const messages = Array.isArray(error) ? error : error ? [error] : [];
  return (
    <fieldset className={cn("flex flex-col gap-2", className)}>
      <legend className="text-sm font-medium text-foreground">{legend}</legend>
      {hint ? <p className="text-xs text-foreground-muted">{hint}</p> : null}
      {children}
      {messages.length > 0 ? (
        <p className="flex items-start gap-1.5 text-xs text-danger-700">
          <AlertCircle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span>{messages.join(" ")}</span>
        </p>
      ) : null}
    </fieldset>
  );
}
