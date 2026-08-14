"use client";

import { useActionState } from "react";
import { Landmark } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import {
  confirmPaymentAction,
  rejectPaymentAction,
  type PaymentActionState,
} from "@/server/payments/actions";
import { formatZmw } from "@/lib/money";

/**
 * Confirmation of an offline payment, shown to the supplier who was paid (and to
 * an administrator resolving a query).
 *
 * BuildLink cannot see a bank account or a mobile-money wallet, so only the
 * person who was paid can say the money arrived. Both pages that need this — the
 * customer's order view and the supplier console — render the same control, so
 * the wording and the audit trail cannot drift apart.
 */
export function ConfirmPaymentForms({
  paymentId,
  amountMinor,
}: {
  paymentId: string;
  amountMinor: number;
}) {
  const [confirmState, confirm] = useActionState<PaymentActionState, FormData>(
    confirmPaymentAction,
    null,
  );
  const [rejectState, reject] = useActionState<PaymentActionState, FormData>(
    rejectPaymentAction,
    null,
  );

  return (
    <div className="space-y-3 rounded-lg border border-gold-200 bg-gold-50 p-3">
      <p className="flex items-start gap-2 text-sm text-foreground">
        <Landmark aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-700" />
        <span>
          The customer says they have sent {formatZmw(amountMinor)}. Check your account, then
          confirm or reject — only you can say the money arrived.
        </span>
      </p>
      <FormMessage state={confirmState} />
      <FormMessage state={rejectState} />

      <div className="flex flex-wrap items-start gap-2">
        <form action={confirm}>
          <input type="hidden" name="paymentId" value={paymentId} />
          <SubmitButton size="sm" pendingText="Confirming…">
            Money received
          </SubmitButton>
        </form>
        <form action={reject} className="flex flex-wrap items-start gap-2">
          <input type="hidden" name="paymentId" value={paymentId} />
          <Input
            name="reason"
            aria-label="Why the payment could not be confirmed"
            placeholder="Nothing has arrived yet"
            className="h-9 w-56"
          />
          <SubmitButton size="sm" variant="outline" pendingText="Saving…">
            Not received
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
