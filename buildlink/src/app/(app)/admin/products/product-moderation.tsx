"use client";

import * as React from "react";
import { useActionState } from "react";
import { Check, X } from "lucide-react";
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
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, fieldError } from "@/components/forms/form-message";
import { moderateProductAction, type AdminActionState } from "@/server/admin/actions";

/**
 * Listing moderation controls.
 *
 * Approval is one click; rejection needs a sentence the supplier can act on.
 * This is the difference between a marketplace with real prices and a classifieds
 * page full of "call for quote".
 */
export function ProductModerationForms({
  productId,
  productName,
  canApprove,
}: {
  productId: string;
  productName: string;
  canApprove: boolean;
}) {
  const [state, formAction] = useActionState<AdminActionState, FormData>(
    moderateProductAction,
    null,
  );

  return (
    <div className="space-y-2">
      <FormMessage state={state} />
      <div className="flex flex-wrap items-center gap-2">
        {canApprove ? (
          <form action={formAction}>
            <input type="hidden" name="productId" value={productId} />
            <input type="hidden" name="decision" value="APPROVE" />
            <SubmitButton size="sm" variant="secondary" pendingText="Approving…">
              <Check aria-hidden />
              Approve
            </SubmitButton>
          </form>
        ) : null}
        <RejectProductDialog productId={productId} productName={productName} />
      </div>
    </div>
  );
}

function RejectProductDialog({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState<AdminActionState, FormData>(
    moderateProductAction,
    null,
  );

  React.useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <X aria-hidden />
          Reject
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject this listing</DialogTitle>
          <DialogDescription>
            {productName} comes off the marketplace and the supplier is told why. They can correct
            it and send it back for approval.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="decision" value="REJECT" />
          <FormMessage state={state} />

          <Field
            name="reason"
            label="What does the supplier need to change?"
            required
            error={fieldError(state, "reason")}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={3}
                placeholder="The photograph is a manufacturer's catalogue image, and the price is given per truck rather than per cubic metre as the unit says."
              />
            )}
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton variant="danger" pendingText="Rejecting…">
              Reject listing
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
