"use client";

import { CreditCard, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PaymentMethod } from "@/types";

const METHODS: {
  id: PaymentMethod;
  title: string;
  description: string;
  Icon: typeof Smartphone;
}[] = [
  {
    id: "MOBILE_MONEY",
    title: "Pay with Mobile Money",
    description: "Airtel Money, MTN MoMo or Zamtel Kwacha",
    Icon: Smartphone,
  },
  {
    id: "BANK_CARD",
    title: "Pay with Bank Card",
    description: "Visa or Mastercard, processed by our payment provider",
    Icon: CreditCard,
  },
];

export function PaymentMethodSelector({
  value,
  disabled,
  onChange,
}: {
  value: PaymentMethod | null;
  disabled?: boolean;
  onChange: (method: PaymentMethod) => void;
}) {
  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="mb-1 text-sm font-medium text-ink">Choose how to pay</legend>

      {METHODS.map((method) => {
        const selected = value === method.id;
        return (
          <label
            key={method.id}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-2xl border bg-white p-4 transition-all",
              selected
                ? "border-blush-500 ring-2 ring-blush-300/60"
                : "border-line hover:border-blush-300",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <input
              type="radio"
              name="payment-method"
              value={method.id}
              checked={selected}
              onChange={() => onChange(method.id)}
              className="size-5 accent-blush-600"
            />
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-2xl",
                selected ? "bg-blush-100 text-blush-700" : "bg-blush-50 text-blush-500",
              )}
            >
              <method.Icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{method.title}</span>
              <span className="block text-xs text-ink-soft">{method.description}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
