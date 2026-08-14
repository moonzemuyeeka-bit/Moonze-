"use client";

import { useState } from "react";
import { CreditCard, Lock } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldHint } from "@/components/ui/field";
import { formatKwacha } from "@/lib/money";
import { cn } from "@/lib/utils";

export type SandboxCard = {
  token: string;
  brand: string;
  last4: string;
  label: string;
  description: string;
};

/**
 * Card payments.
 *
 * The app never touches card numbers, CVV or PINs: the provider's hosted fields
 * mint a token and only that token, the brand and the last four digits ever
 * reach our servers. In sandbox mode you pick one of the provider's test cards,
 * which is exactly what a tokenised flow looks like from our side.
 */
export function CardPayment({
  depositNgwee,
  cards,
  sandbox,
  submitting,
  fieldErrors,
  onPay,
}: {
  depositNgwee: number;
  cards: SandboxCard[];
  sandbox: boolean;
  submitting: boolean;
  fieldErrors?: Record<string, string>;
  onPay: (details: { token: string }) => void;
}) {
  const [token, setToken] = useState(cards[0]?.token ?? "");

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onPay({ token });
      }}
    >
      {sandbox ? (
        <Alert tone="info" title="Sandbox card checkout">
          <p>
            No real card details are collected or stored. Choose one of the provider&apos;s
            test cards below to exercise the authorisation flow.
          </p>
        </Alert>
      ) : null}

      <fieldset className="space-y-2.5">
        <legend className="mb-1 text-sm font-medium text-ink">Card</legend>
        {cards.map((card) => {
          const selected = token === card.token;
          return (
            <label
              key={card.token}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-2xl border bg-white p-4 transition-all",
                selected
                  ? "border-blush-500 ring-2 ring-blush-300/60"
                  : "border-line hover:border-blush-300",
              )}
            >
              <input
                type="radio"
                name="sandbox-card"
                value={card.token}
                checked={selected}
                onChange={() => setToken(card.token)}
                className="size-5 accent-blush-600"
              />
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blush-50 text-blush-600">
                <CreditCard className="size-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{card.label}</span>
                <span className="block text-xs text-ink-soft">{card.description}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {fieldErrors?.card ? (
        <p className="text-sm text-rose-alert-700" role="alert">
          {fieldErrors.card}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        full
        loading={submitting}
        loadingText="Contacting your bank…"
        disabled={!token}
      >
        <Lock aria-hidden />
        Pay {formatKwacha(depositNgwee)} by card
      </Button>

      <FieldHint>
        Card data is tokenised by the payment provider. Koko&apos;s Bookings stores only
        the card brand and last four digits for your receipt.
      </FieldHint>
    </form>
  );
}
