"use client";

import * as React from "react";
import { useActionState } from "react";
import { BadgeCheck, Ban, Check, Undo2, X } from "lucide-react";
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
import { Field, FieldRow } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, fieldError } from "@/components/forms/form-message";
import {
  decideDocumentAction,
  decideVerificationAction,
  setSupplierCommercialsAction,
  setSupplierSuspensionAction,
  type AdminActionState,
} from "@/server/admin/actions";
import { SUBSCRIPTION_TIER_LABELS } from "@/lib/labels";
import type { SubscriptionTier } from "@prisma/client";

/**
 * Verification and commercial controls.
 *
 * Approving a document is one click because an administrator reading a stack of
 * PACRA certificates should not have to fill in a form for each one. Rejecting
 * anything demands a reason, because the supplier is shown it and has to be able
 * to act on it.
 */

export function DocumentDecisionForms({
  documentId,
  reviewStatus,
}: {
  documentId: string;
  reviewStatus: "PENDING" | "APPROVED" | "REJECTED";
}) {
  const [state, formAction] = useActionState<AdminActionState, FormData>(
    decideDocumentAction,
    null,
  );

  return (
    <div className="space-y-2">
      <FormMessage state={state} />
      <div className="flex flex-wrap items-center gap-2">
        {reviewStatus === "APPROVED" ? null : (
          <form action={formAction}>
            <input type="hidden" name="documentId" value={documentId} />
            <input type="hidden" name="decision" value="APPROVED" />
            <SubmitButton size="sm" variant="secondary" pendingText="Accepting…">
              <Check aria-hidden />
              Accept
            </SubmitButton>
          </form>
        )}
        {reviewStatus === "REJECTED" ? null : (
          <RejectDocumentDialog documentId={documentId} />
        )}
      </div>
    </div>
  );
}

function RejectDocumentDialog({ documentId }: { documentId: string }) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState<AdminActionState, FormData>(
    decideDocumentAction,
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
          <DialogTitle>Reject this document</DialogTitle>
          <DialogDescription>
            The supplier is told immediately and can upload a replacement. Say what was wrong with
            it — &ldquo;rejected&rdquo; on its own just generates a support call.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="documentId" value={documentId} />
          <input type="hidden" name="decision" value="REJECTED" />
          <FormMessage state={state} />

          <Field
            name="note"
            label="What is wrong with it?"
            required
            error={fieldError(state, "note")}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={3}
                placeholder="The certificate is cut off on the right-hand side and the registration number cannot be read."
              />
            )}
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton variant="danger" pendingText="Rejecting…">
              Reject document
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function VerificationDecisionForms({
  supplierId,
  businessName,
  approvedDocuments,
  isVerified,
}: {
  supplierId: string;
  businessName: string;
  approvedDocuments: number;
  isVerified: boolean;
}) {
  const [state, formAction] = useActionState<AdminActionState, FormData>(
    decideVerificationAction,
    null,
  );

  return (
    <div className="space-y-3">
      <FormMessage state={state} successMessage="Decision recorded and the supplier notified." />

      {approvedDocuments === 0 ? (
        <Alert tone="warning" hideIcon>
          No document has been accepted yet. Verification means BuildLink has seen the paperwork, so
          it cannot be granted until at least one document is accepted above.
        </Alert>
      ) : null}

      {isVerified ? null : (
        <form action={formAction}>
          <input type="hidden" name="supplierId" value={supplierId} />
          <input type="hidden" name="decision" value="VERIFIED" />
          <SubmitButton block disabled={approvedDocuments === 0} pendingText="Verifying…">
            <BadgeCheck aria-hidden />
            Verify {businessName}
          </SubmitButton>
        </form>
      )}

      <RejectVerificationDialog supplierId={supplierId} businessName={businessName} />
    </div>
  );
}

function RejectVerificationDialog({
  supplierId,
  businessName,
}: {
  supplierId: string;
  businessName: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState<AdminActionState, FormData>(
    decideVerificationAction,
    null,
  );

  React.useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" block>
          <X aria-hidden />
          Reject the application
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject {businessName}&apos;s verification</DialogTitle>
          <DialogDescription>
            They keep their account and can trade unverified, but customers will see that BuildLink
            could not confirm the business. They can fix the documents and reapply.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="supplierId" value={supplierId} />
          <input type="hidden" name="decision" value="REJECTED" />
          <FormMessage state={state} />

          <Field
            name="note"
            label="What could not be confirmed?"
            required
            hint="Shown to the supplier and stored with the decision."
            error={fieldError(state, "note")}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={3}
                placeholder="The PACRA number on the certificate belongs to a different company name."
              />
            )}
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton variant="danger" pendingText="Recording…">
              Reject verification
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Stops or restarts trading without touching the owner's login. */
export function SuspendSupplierDialog({
  supplierId,
  businessName,
  isSuspended,
}: {
  supplierId: string;
  businessName: string;
  isSuspended: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState<AdminActionState, FormData>(
    setSupplierSuspensionAction,
    null,
  );

  React.useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={isSuspended ? "primary" : "outline"} size="sm">
          {isSuspended ? <Undo2 aria-hidden /> : <Ban aria-hidden />}
          {isSuspended ? "Restore trading" : "Suspend trading"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isSuspended ? `Restore ${businessName}?` : `Suspend ${businessName}?`}
          </DialogTitle>
          <DialogDescription>
            {isSuspended
              ? "Their listings can be shown to customers again and their verification goes back into the review queue."
              : "Their listings disappear from search and no new order can be placed with them. Existing orders are unaffected — customers still need their materials."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="supplierId" value={supplierId} />
          <input type="hidden" name="suspend" value={isSuspended ? "false" : "true"} />
          <FormMessage state={state} />

          <Field
            name="reason"
            label={isSuspended ? "Note for the record" : "Why are you suspending them?"}
            required={!isSuspended}
            hint="The supplier is shown this."
            error={fieldError(state, "reason")}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={3}
                placeholder={
                  isSuspended
                    ? "Outstanding deliveries were completed and the customer confirmed receipt."
                    : "Four disputes in a month for materials paid for and not delivered."
                }
              />
            )}
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton
              variant={isSuspended ? "primary" : "danger"}
              pendingText={isSuspended ? "Restoring…" : "Suspending…"}
            >
              {isSuspended ? "Restore trading" : "Suspend trading"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Subscription tier and the commission override for this one business. */
export function CommercialsForm({
  supplierId,
  subscriptionTier,
  commissionRateBps,
  defaultRateBps,
  commissionEnabled,
}: {
  supplierId: string;
  subscriptionTier: SubscriptionTier;
  commissionRateBps: number | null;
  defaultRateBps: number;
  commissionEnabled: boolean;
}) {
  const [state, formAction] = useActionState<AdminActionState, FormData>(
    setSupplierCommercialsAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="supplierId" value={supplierId} />
      <FormMessage state={state} successMessage="Commercial terms saved." />

      <FieldRow>
        <Field
          name="subscriptionTier"
          label="Subscription tier"
          error={fieldError(state, "subscriptionTier")}
        >
          {(control) => (
            <NativeSelect {...control} defaultValue={subscriptionTier}>
              {(["FREE", "STANDARD", "PREMIUM"] as const).map((tier) => (
                <option key={tier} value={tier}>
                  {SUBSCRIPTION_TIER_LABELS[tier]}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>

        <Field
          name="commissionRateBps"
          label="Commission rate (basis points)"
          hint={`Leave blank to use the platform default of ${defaultRateBps} bps (${(defaultRateBps / 100).toFixed(2)}%).`}
          error={fieldError(state, "commissionRateBps")}
        >
          {(control) => (
            <Input
              {...control}
              type="number"
              inputMode="numeric"
              min="0"
              max="5000"
              step="1"
              defaultValue={commissionRateBps ?? ""}
              placeholder={String(defaultRateBps)}
            />
          )}
        </Field>
      </FieldRow>

      {commissionEnabled ? null : (
        <p className="text-xs text-foreground-muted">
          Commission is switched off platform-wide, so this rate is recorded but not charged. It
          applies to orders placed after commission is turned on.
        </p>
      )}

      <SubmitButton size="sm" pendingText="Saving…">
        Save commercial terms
      </SubmitButton>
    </form>
  );
}
