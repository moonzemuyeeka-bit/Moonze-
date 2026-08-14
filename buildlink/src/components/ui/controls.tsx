"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "peer size-5 shrink-0 rounded border border-border-strong bg-surface transition-colors data-[state=checked]:border-brand-700 data-[state=checked]:bg-brand-700 data-[state=indeterminate]:border-brand-700 data-[state=indeterminate]:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-white">
        {props.checked === "indeterminate" ? (
          <Minus className="size-3.5" />
        ) : (
          <Check className="size-3.5" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

/** Checkbox plus label in a tappable row, sized for thumbs. */
export function CheckboxField({
  id,
  label,
  description,
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root> & {
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <Checkbox id={id} className="mt-0.5" {...props} />
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-sm font-medium text-foreground">
          {label}
        </label>
        {description ? (
          <p className="text-xs text-foreground-muted">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

export const RadioGroup = RadioGroupPrimitive.Root;

export function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      className={cn(
        "size-5 shrink-0 rounded-full border border-border-strong bg-surface transition-colors data-[state=checked]:border-brand-700 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex size-full items-center justify-center">
        <span className="size-2.5 rounded-full bg-brand-700" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
}

/**
 * Radio rendered as a selectable card. Used for the choices that carry real
 * weight — what you are building, how you want it delivered, how you paid.
 */
export function RadioCard({
  id,
  value,
  title,
  description,
  icon,
  className,
  disabled,
}: {
  id: string;
  value: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40 has-[[data-state=checked]]:border-brand-600 has-[[data-state=checked]]:bg-brand-50 has-[[data-state=checked]]:ring-1 has-[[data-state=checked]]:ring-brand-600",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <RadioGroupItem id={id} value={value} disabled={disabled} className="mt-0.5" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {icon}
          {title}
        </span>
        {description ? (
          <span className="mt-0.5 block text-xs text-foreground-muted">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

export function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-ink-300 transition-colors data-[state=checked]:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
    </SwitchPrimitive.Root>
  );
}

export function Progress({
  value,
  className,
  tone = "brand",
  label,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  value: number;
  tone?: "brand" | "gold" | "danger";
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <ProgressPrimitive.Root
      value={clamped}
      aria-label={label}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-ink-100", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full rounded-full transition-[width] duration-500",
          tone === "brand" && "bg-brand-600",
          tone === "gold" && "bg-gold-500",
          tone === "danger" && "bg-danger-500",
        )}
        style={{ width: `${clamped}%` }}
      />
    </ProgressPrimitive.Root>
  );
}
