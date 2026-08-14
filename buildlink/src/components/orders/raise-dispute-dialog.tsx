"use client";

import * as React from "react";
import { useActionState } from "react";
import { ShieldAlert } from "lucide-react";
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
import { NativeSelect, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, fieldError } from "@/components/forms/form-message";
import { raiseDisputeAction, type RaiseDisputeState } from "@/server/disputes/actions";
import { DISPUTE_REASONS, DISPUTE_REASON_LABELS } from "@/lib/labels";

/**
 * Raising a dispute.
 *
 * Shared by the customer and supplier order pages because the mechanism is the
 * same for both, and the wording is deliberately plain: the person filling this
 * in is already annoyed, and asking them to categorise their problem is enough
 * work without also making them guess what BuildLink will do next.
 */
export function RaiseDisputeDialog({
  orderId,
  orderNumber,
  counterpartyName,
}: {
  orderId: string;
  orderNumber: string;
  counterpartyName: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState<RaiseDisputeState, FormData>(
    raiseDisputeAction,
    null,
  );

  React.useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ShieldAlert aria-hidden />
          Raise a dispute
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Raise a dispute on {orderNumber}</DialogTitle>
          <DialogDescription>
            Use this when something has gone wrong that you and {counterpartyName} cannot settle
            between you. BuildLink reads both sides, the order history and the delivery record, then
            records a decision both of you can see.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="orderId" value={orderId} />
          <FormMessage state={state} />

          <Field
            name="reason"
            label="What has gone wrong?"
            required
            error={fieldError(state, "reason")}
          >
            {(control) => (
              <NativeSelect {...control} defaultValue="">
                <option value="" disabled>
                  Choose the closest match
                </option>
                {DISPUTE_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {DISPUTE_REASON_LABELS[reason]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>

          <Field
            name="description"
            label="What happened?"
            required
            hint="Dates, quantities, who you spoke to and what was agreed. The more specific this is, the faster it can be decided."
            error={fieldError(state, "description")}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={5}
                placeholder="I ordered 200 blocks on 4 August. 160 arrived on 6 August and the driver said the rest would follow. Nothing has come since and calls are not being answered."
              />
            )}
          </Field>

          <Alert tone="warning" hideIcon>
            BuildLink can record what was ordered, paid and delivered, and can suspend a business
            that repeatedly fails its customers. It cannot recover money on your behalf — BuildLink
            never held it.
          </Alert>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Not yet
            </Button>
            <SubmitButton pendingText="Sending…">Raise the dispute</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
