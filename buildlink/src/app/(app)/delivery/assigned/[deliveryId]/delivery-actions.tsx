"use client";

import * as React from "react";
import { useActionState } from "react";
import { Camera, CheckCircle2, TriangleAlert } from "lucide-react";
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
import { Input, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, fieldError } from "@/components/forms/form-message";
import {
  completeDeliveryAction,
  failDeliveryAction,
  updateDeliveryStatusAction,
  type DeliveryActionState,
} from "@/server/delivery/actions";
import type { DeliveryStatus } from "@prisma/client";

/**
 * Driver-side controls.
 *
 * Big single-purpose buttons, one action per form: these are pressed one-handed,
 * often in bright sun, sometimes on a connection that drops mid-request.
 */

export function AdvanceDeliveryForm({
  deliveryId,
  to,
  label,
}: {
  deliveryId: string;
  to: DeliveryStatus;
  label: string;
}) {
  const [state, formAction] = useActionState<DeliveryActionState, FormData>(
    updateDeliveryStatusAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="deliveryId" value={deliveryId} />
      <input type="hidden" name="status" value={to} />
      <FormMessage state={state} />
      <SubmitButton block size="lg" pendingText="Saving…">
        {label}
      </SubmitButton>
    </form>
  );
}

/**
 * Completing the job. The photograph and the name of whoever received the goods
 * are what turn "I delivered it" into something the other two parties can rely
 * on, so they are collected together.
 */
export function CompleteDeliveryForm({
  deliveryId,
  proofRequired,
}: {
  deliveryId: string;
  proofRequired: boolean;
}) {
  const [state, formAction] = useActionState<DeliveryActionState, FormData>(
    completeDeliveryAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="deliveryId" value={deliveryId} />
      <FormMessage state={state} />

      <Field
        name="receivedBy"
        label="Who received the goods?"
        required
        hint="The name of the person who signed for them on site."
        error={fieldError(state, "receivedBy")}
      >
        {(control) => <Input {...control} autoComplete="off" placeholder="Mary Banda" />}
      </Field>

      <Field
        name="proof"
        label="Photo of the delivered goods"
        required={proofRequired}
        hint={
          proofRequired
            ? "Required: a photo taken at the delivery point."
            : "Optional, but it settles most disputes before they start."
        }
        error={fieldError(state, "proof")}
      >
        {(control) => (
          <Input
            {...control}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
          />
        )}
      </Field>

      <Field name="note" label="Anything to note?" error={fieldError(state, "note")}>
        {(control) => (
          <Textarea {...control} rows={2} placeholder="Left at the gate with the site foreman." />
        )}
      </Field>

      <SubmitButton block size="lg" pendingText="Recording delivery…">
        <CheckCircle2 aria-hidden />
        Mark delivered
      </SubmitButton>
      <p className="text-xs text-foreground-muted">
        <Camera aria-hidden className="mr-1 inline size-3.5" />
        The photo is private to the customer, the supplier and BuildLink.
      </p>
    </form>
  );
}

export function FailDeliveryDialog({ deliveryId }: { deliveryId: string }) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState<DeliveryActionState, FormData>(
    failDeliveryAction,
    null,
  );

  React.useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" block>
          <TriangleAlert aria-hidden />
          I could not deliver
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>What stopped the delivery?</DialogTitle>
          <DialogDescription>
            The customer and the supplier both see this. A failed delivery can be picked up again
            once the problem is sorted out.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="deliveryId" value={deliveryId} />
          <FormMessage state={state} />

          <Field name="reason" label="Reason" required error={fieldError(state, "reason")}>
            {(control) => (
              <Textarea
                {...control}
                rows={3}
                placeholder="Nobody was on site and the gate was locked."
              />
            )}
          </Field>

          <Alert tone="info" hideIcon>
            If the road is impassable or the site is unreachable, say so — it helps the supplier
            plan the next attempt.
          </Alert>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Go back
            </Button>
            <SubmitButton variant="danger" pendingText="Saving…">
              Report the problem
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
