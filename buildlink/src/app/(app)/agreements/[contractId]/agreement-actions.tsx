"use client";

import * as React from "react";
import { useActionState } from "react";
import { Ban, Check, Send, X } from "lucide-react";
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
import { CheckboxField } from "@/components/ui/controls";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, fieldError } from "@/components/forms/form-message";
import {
  cancelContractAction,
  respondToContractAction,
  sendContractAction,
  type ContractActionState,
} from "@/server/contracts/actions";

/**
 * Agreement decisions.
 *
 * Accepting is deliberately more work than clicking a button: the party has to
 * confirm they have read it and type their own name, which is what the
 * acceptance record stores alongside the agreement version, the time and the IP.
 */

export function RespondToAgreementForms({
  contractId,
  contractNumber,
  suggestedName,
  totalLabel,
  counterpartyLabel,
}: {
  contractId: string;
  contractNumber: string;
  suggestedName: string;
  totalLabel: string;
  counterpartyLabel: string;
}) {
  const [state, formAction] = useActionState<ContractActionState, FormData>(
    respondToContractAction,
    null,
  );
  const [confirmed, setConfirmed] = React.useState(false);

  return (
    <div className="space-y-4">
      <FormMessage state={state} />

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="contractId" value={contractId} />
        <input type="hidden" name="decision" value="ACCEPT" />

        <Field
          name="signatureName"
          label="Type your full name to accept"
          required
          hint={`This records that you, personally, accepted agreement ${contractNumber} for ${totalLabel}.`}
          error={fieldError(state, "signatureName")}
        >
          {(control) => (
            <Input {...control} autoComplete="name" placeholder={suggestedName} />
          )}
        </Field>

        <CheckboxField
          id="agreement-read"
          label="I have read the items, prices and terms above"
          checked={confirmed}
          onCheckedChange={(value) => setConfirmed(value === true)}
        />

        <SubmitButton block disabled={!confirmed} pendingText="Recording your acceptance…">
          <Check aria-hidden />
          Accept this agreement
        </SubmitButton>
      </form>

      <RejectAgreementDialog
        contractId={contractId}
        contractNumber={contractNumber}
        counterpartyLabel={counterpartyLabel}
      />
    </div>
  );
}

function RejectAgreementDialog({
  contractId,
  contractNumber,
  counterpartyLabel,
}: {
  contractId: string;
  contractNumber: string;
  counterpartyLabel: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState<ContractActionState, FormData>(
    respondToContractAction,
    null,
  );

  React.useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" block>
          <X aria-hidden />
          Reject it
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject agreement {contractNumber}?</DialogTitle>
          <DialogDescription>
            {counterpartyLabel} is told why. If this agreement belongs to an order, the order is
            cancelled and any stock held for it is released.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="contractId" value={contractId} />
          <input type="hidden" name="decision" value="REJECT" />
          <FormMessage state={state} />

          <Field
            name="signatureName"
            label="Type your full name"
            required
            error={fieldError(state, "signatureName")}
          >
            {(control) => <Input {...control} autoComplete="name" />}
          </Field>

          <Field
            name="reason"
            label="Why are you rejecting it?"
            error={fieldError(state, "reason")}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={3}
                placeholder="The delivery date does not work for my slab pour."
              />
            )}
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Go back
            </Button>
            <SubmitButton variant="danger" pendingText="Saving…">
              Reject agreement
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Sends a draft agreement to the other party for their decision. */
export function SendAgreementForm({ contractId }: { contractId: string }) {
  const [state, formAction] = useActionState<ContractActionState, FormData>(
    sendContractAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="contractId" value={contractId} />
      <FormMessage state={state} />
      <SubmitButton block pendingText="Sending…">
        <Send aria-hidden />
        Send for acceptance
      </SubmitButton>
    </form>
  );
}

export function CancelAgreementDialog({
  contractId,
  contractNumber,
}: {
  contractId: string;
  contractNumber: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState<ContractActionState, FormData>(
    cancelContractAction,
    null,
  );

  React.useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Ban aria-hidden />
          Cancel agreement
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel agreement {contractNumber}?</DialogTitle>
          <DialogDescription>
            The other party is told why. Cancelling the agreement does not by itself settle money
            that has already changed hands.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="contractId" value={contractId} />
          <FormMessage state={state} />

          <Field
            name="reason"
            label="Why are you cancelling?"
            required
            error={fieldError(state, "reason")}
          >
            {(control) => <Textarea {...control} rows={3} />}
          </Field>

          <Alert tone="warning" hideIcon>
            An order attached to this agreement is not cancelled automatically — cancel the order
            itself if that is what you mean to do.
          </Alert>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Keep it
            </Button>
            <SubmitButton variant="danger" pendingText="Cancelling…">
              Cancel agreement
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
