"use client";

import * as React from "react";
import { useActionState } from "react";
import { Eye, Gavel } from "lucide-react";
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
import { Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, fieldError } from "@/components/forms/form-message";
import { decideDisputeAction, type AdminActionState } from "@/server/admin/actions";

/**
 * Deciding a dispute.
 *
 * Two controls, in the order they are used. Acknowledging is one click because
 * telling both parties "we have seen this" should never be delayed by a form.
 * Closing demands a written decision, because that text is the entire product:
 * it is what the customer and the supplier are both shown, and what the audit
 * log keeps.
 */

/** Marks the dispute as being looked at, which notifies both parties. */
export function AcknowledgeDisputeForm({ disputeId }: { disputeId: string }) {
  const [state, formAction] = useActionState<AdminActionState, FormData>(
    decideDisputeAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="disputeId" value={disputeId} />
      <input type="hidden" name="status" value="UNDER_REVIEW" />
      <FormMessage state={state} successMessage="Both parties have been told you are on it." />
      <SubmitButton size="sm" variant="secondary" pendingText="Telling them…">
        <Eye aria-hidden />
        Mark as under review
      </SubmitButton>
    </form>
  );
}

export function DecideDisputeDialog({
  disputeId,
  orderNumber,
  outcome,
}: {
  disputeId: string;
  orderNumber: string;
  /** `RESOLVED` means the complaint was upheld or settled; `CLOSED` means no further action. */
  outcome: "RESOLVED" | "CLOSED";
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState<AdminActionState, FormData>(
    decideDisputeAction,
    null,
  );

  React.useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  const resolving = outcome === "RESOLVED";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={resolving ? "primary" : "outline"}>
          <Gavel aria-hidden />
          {resolving ? "Record a resolution" : "Close without action"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {resolving ? `Resolve the dispute on ${orderNumber}` : `Close the dispute on ${orderNumber}`}
          </DialogTitle>
          <DialogDescription>
            {resolving
              ? "Write what was agreed or decided, and what each side is expected to do. Both the customer and the supplier are shown these exact words."
              : "Use this when there is nothing for BuildLink to decide — a misunderstanding, a duplicate, or a matter the two parties settled themselves. Both of them are shown your note."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="disputeId" value={disputeId} />
          <input type="hidden" name="status" value={outcome} />
          <FormMessage state={state} />

          <Field
            name="resolution"
            label={resolving ? "The decision" : "Why there is nothing to decide"}
            required
            hint="Plain language. This is read by people who are already frustrated."
            error={fieldError(state, "resolution")}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={5}
                placeholder={
                  resolving
                    ? "The supplier confirmed 40 blocks were short and has agreed to deliver them by Friday 22 August at no extra cost. The customer has agreed to this and will confirm receipt on the order."
                    : "The customer confirmed the balance arrived on 9 August and asked to withdraw the dispute. No action needed from either side."
                }
              />
            )}
          </Field>

          <Alert tone="info" hideIcon>
            BuildLink can record what was ordered, paid and delivered, and can suspend a business
            that repeatedly fails its customers. It cannot move money, because it never held any.
          </Alert>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Recording…">
              {resolving ? "Record the resolution" : "Close the dispute"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
