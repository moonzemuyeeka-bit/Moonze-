"use client";

import * as React from "react";
import { useActionState } from "react";
import { Eye, EyeOff, PencilLine } from "lucide-react";
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
import { moderateReviewAction, type AdminActionState } from "@/server/admin/actions";

/**
 * Review moderation controls.
 *
 * The bar for hiding a review is deliberately high, and the copy in this dialog
 * says so: a marketplace where bad reviews quietly disappear has ratings nobody
 * believes, which hurts good suppliers more than bad ones. Reopening for
 * amendment is the softer instrument — it lets a customer who has since been
 * looked after change their own words rather than having them removed.
 */
export function ReviewModerationControls({
  reviewId,
  isHidden,
  amendmentAllowed,
}: {
  reviewId: string;
  isHidden: boolean;
  amendmentAllowed: boolean;
}) {
  const [state, formAction] = useActionState<AdminActionState, FormData>(
    moderateReviewAction,
    null,
  );

  return (
    <div className="space-y-2">
      <FormMessage state={state} />
      <div className="flex flex-wrap items-center gap-2">
        {isHidden ? (
          <form action={formAction}>
            <input type="hidden" name="reviewId" value={reviewId} />
            <input type="hidden" name="action" value="PUBLISH" />
            <SubmitButton size="sm" variant="secondary" pendingText="Restoring…">
              <Eye aria-hidden />
              Restore
            </SubmitButton>
          </form>
        ) : (
          <HideReviewDialog reviewId={reviewId} />
        )}

        {amendmentAllowed ? (
          <span className="text-xs text-foreground-muted">Customer may amend</span>
        ) : (
          <form action={formAction}>
            <input type="hidden" name="reviewId" value={reviewId} />
            <input type="hidden" name="action" value="ALLOW_AMENDMENT" />
            <SubmitButton size="sm" variant="ghost" pendingText="Reopening…">
              <PencilLine aria-hidden />
              Let them amend it
            </SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}

function HideReviewDialog({ reviewId }: { reviewId: string }) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState<AdminActionState, FormData>(
    moderateReviewAction,
    null,
  );

  React.useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <EyeOff aria-hidden />
          Hide
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hide this review</DialogTitle>
          <DialogDescription>
            The review stops appearing on the supplier&apos;s profile and their rating is
            recalculated without it.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="reviewId" value={reviewId} />
          <input type="hidden" name="action" value="HIDE" />
          <FormMessage state={state} />

          <Alert tone="warning" hideIcon>
            Hide a review for abuse, personal information, or a mistake about which business it
            concerns. A review that is simply unflattering stays up — suppliers earn their ratings
            and customers have to be able to trust them.
          </Alert>

          <Field
            name="reason"
            label="Why is it being hidden?"
            required
            hint="Kept in the audit log against your name."
            error={fieldError(state, "reason")}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={3}
                placeholder="The review names and abuses the supplier's employee and includes their phone number."
              />
            )}
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton variant="danger" pendingText="Hiding…">
              Hide review
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
