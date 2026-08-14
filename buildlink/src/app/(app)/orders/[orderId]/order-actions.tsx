"use client";

import * as React from "react";
import { useActionState } from "react";
import { Ban, CheckCircle2, CreditCard, Landmark, Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, fieldError } from "@/components/forms/form-message";
import {
  cancelOrderAction,
  completeOrderAction,
  type OrderActionState,
} from "@/server/orders/actions";
import {
  confirmPaymentAction,
  initiatePaymentAction,
  recordPaymentAction,
  rejectPaymentAction,
  settleSandboxPaymentAction,
  verifyPaymentAction,
  type PaymentActionState,
} from "@/server/payments/actions";
import { formatZmw, toKwacha } from "@/lib/money";

/**
 * Customer-side order controls.
 *
 * Each one is its own form with its own action state, so a failed cancellation
 * cannot leave a payment form showing a stale error — and every one degrades to a
 * plain HTML submission if the JavaScript never arrives.
 */

export function RecordPaymentDialog({
  orderId,
  outstandingMinor,
}: {
  orderId: string;
  outstandingMinor: number;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState<PaymentActionState, FormData>(
    recordPaymentAction,
    null,
  );

  React.useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button block>
          <Wallet aria-hidden />
          Record a payment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a payment you have made</DialogTitle>
          <DialogDescription>
            Use this when you have paid the supplier directly — cash, a bank transfer or your own
            mobile money. The supplier then confirms the money reached them.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="orderId" value={orderId} />
          <FormMessage state={state} />

          <Field
            name="method"
            label="How did you pay?"
            required
            error={fieldError(state, "method")}
          >
            {(control) => (
              <NativeSelect {...control} defaultValue="RECORDED_MOBILE_MONEY">
                <option value="RECORDED_MOBILE_MONEY">Mobile money (Airtel, MTN, Zamtel)</option>
                <option value="RECORDED_BANK_TRANSFER">Bank transfer or deposit</option>
                <option value="RECORDED_CASH">Cash</option>
              </NativeSelect>
            )}
          </Field>

          <Field
            name="amountMinor"
            label="Amount paid (ZMW)"
            required
            hint={`Outstanding on this order: ${formatZmw(outstandingMinor)}`}
            error={fieldError(state, "amountMinor")}
          >
            {(control) => (
              <Input
                {...control}
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                max={toKwacha(outstandingMinor)}
                defaultValue={toKwacha(outstandingMinor)}
              />
            )}
          </Field>

          <Field
            name="reference"
            label="Transaction reference"
            hint="The mobile-money transaction id or bank reference, so the supplier can find it."
            error={fieldError(state, "reference")}
          >
            {(control) => <Input {...control} placeholder="MP260814.1423.A12345" />}
          </Field>

          <Field name="note" label="Note for the supplier" error={fieldError(state, "note")}>
            {(control) => <Textarea {...control} rows={2} />}
          </Field>

          <Alert tone="info" hideIcon>
            BuildLink records this payment. It does not hold or transmit your money, and recording
            it here does not by itself prove the supplier received it.
          </Alert>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Recording…">Record payment</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Starts a provider-processed payment for the outstanding balance. */
export function PayOnlineForm({
  orderId,
  outstandingMinor,
  providerLabel,
}: {
  orderId: string;
  outstandingMinor: number;
  providerLabel: string;
}) {
  const [state, formAction] = useActionState<PaymentActionState, FormData>(
    initiatePaymentAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="amountMinor" value={toKwacha(outstandingMinor)} />
      <FormMessage state={state} />
      <SubmitButton block variant="secondary" pendingText="Starting payment…">
        <CreditCard aria-hidden />
        Pay {formatZmw(outstandingMinor)} with {providerLabel}
      </SubmitButton>
    </form>
  );
}

/** Re-asks the provider what happened, for a customer who approved on their phone. */
export function VerifyPaymentForm({ paymentId }: { paymentId: string }) {
  const [state, formAction] = useActionState<PaymentActionState, FormData>(
    verifyPaymentAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="paymentId" value={paymentId} />
      <FormMessage state={state} />
      <SubmitButton size="sm" variant="outline" pendingText="Checking…">
        I have approved it — check again
      </SubmitButton>
    </form>
  );
}

/**
 * Sandbox controls. Rendered only when the sandbox provider is active, and
 * labelled so a test payment can never be mistaken for a real one.
 */
export function SandboxSettleForms({ paymentId }: { paymentId: string }) {
  const [state, formAction] = useActionState<PaymentActionState, FormData>(
    settleSandboxPaymentAction,
    null,
  );

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-gold-300 bg-gold-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gold-800">
        Sandbox controls — no real money
      </p>
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <form action={formAction}>
          <input type="hidden" name="paymentId" value={paymentId} />
          <input type="hidden" name="outcome" value="SUCCESSFUL" />
          <SubmitButton size="sm" pendingText="Simulating…">
            Simulate approval
          </SubmitButton>
        </form>
        <form action={formAction}>
          <input type="hidden" name="paymentId" value={paymentId} />
          <input type="hidden" name="outcome" value="FAILED" />
          <SubmitButton size="sm" variant="outline" pendingText="Simulating…">
            Simulate decline
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}

export function ConfirmCompleteForm({ orderId }: { orderId: string }) {
  const [state, formAction] = useActionState<OrderActionState, FormData>(
    completeOrderAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="orderId" value={orderId} />
      <FormMessage state={state} />
      <SubmitButton block pendingText="Confirming…">
        <CheckCircle2 aria-hidden />
        Everything arrived — complete this order
      </SubmitButton>
    </form>
  );
}

export function CancelOrderDialog({
  orderId,
  orderNumber,
}: {
  orderId: string;
  orderNumber: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState<OrderActionState, FormData>(cancelOrderAction, null);

  React.useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Ban aria-hidden />
          Cancel order
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel order {orderNumber}?</DialogTitle>
          <DialogDescription>
            The supplier is told why, the stock goes back on their shelf and any commitment recorded
            against your project budget is released. Money you have already paid is a matter between
            you and the supplier.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="orderId" value={orderId} />
          <FormMessage state={state} />

          <Field
            name="reason"
            label="Why are you cancelling?"
            required
            error={fieldError(state, "reason")}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={3}
                placeholder="I found the same blocks closer to the site."
              />
            )}
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Keep the order
            </Button>
            <SubmitButton variant="danger" pendingText="Cancelling…">
              Cancel order
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Supplier and admin view of an offline payment they have to confirm. */
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
