"use client";

import * as React from "react";
import { useActionState } from "react";
import { ShieldOff, UserCheck, UserCog } from "lucide-react";
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
import {
  setUserRoleAction,
  setUserStatusAction,
  type AdminActionState,
} from "@/server/admin/actions";
import { ASSIGNABLE_ROLES } from "@/lib/validation/admin";
import { USER_ROLE_LABELS } from "@/lib/labels";
import type { UserRole, UserStatus } from "@prisma/client";

/**
 * Account controls.
 *
 * Suspending somebody is the most damaging thing an administrator can do to an
 * honest user, so each of these asks for a written reason and states plainly what
 * the person on the other end will experience.
 */

export function SuspendUserDialog({
  userId,
  name,
  status,
  isSupplier,
}: {
  userId: string;
  name: string;
  status: UserStatus;
  isSupplier: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState<AdminActionState, FormData>(setUserStatusAction, null);

  React.useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  const isActive = status === "ACTIVE";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={isActive ? "outline" : "primary"} size="sm">
          {isActive ? <ShieldOff aria-hidden /> : <UserCheck aria-hidden />}
          {isActive ? "Suspend account" : "Restore account"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isActive ? `Suspend ${name}?` : `Restore ${name}?`}</DialogTitle>
          <DialogDescription>
            {isActive
              ? "They are signed out everywhere immediately and cannot sign back in."
              : "They can sign in and use BuildLink again."}
            {isSupplier
              ? isActive
                ? " Their listings are hidden and their business stops trading."
                : " Their business can trade again and their verification returns to the review queue."
              : ""}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="status" value={isActive ? "SUSPENDED" : "ACTIVE"} />
          <FormMessage state={state} />

          <Field
            name="reason"
            label={isActive ? "Why are you suspending this account?" : "Note for the record"}
            required={isActive}
            hint="The account holder is shown this, and it is stored in the audit log."
            error={fieldError(state, "reason")}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={3}
                placeholder={
                  isActive
                    ? "Three customers reported taking payment for materials that were never delivered."
                    : "Documents provided and the reported issues were resolved."
                }
              />
            )}
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton
              variant={isActive ? "danger" : "primary"}
              pendingText={isActive ? "Suspending…" : "Restoring…"}
            >
              {isActive ? "Suspend account" : "Restore account"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Role changes are super-administrator only, and always sign the person out. */
export function ChangeRoleDialog({
  userId,
  name,
  role,
}: {
  userId: string;
  name: string;
  role: UserRole;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState<AdminActionState, FormData>(setUserRoleAction, null);

  React.useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserCog aria-hidden />
          Change role
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change what {name} can do</DialogTitle>
          <DialogDescription>
            A role decides which console this person lands on and what they may do. They are signed
            out so the new role takes effect on their next sign-in.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="userId" value={userId} />
          <FormMessage state={state} />

          <Field name="role" label="New role" required error={fieldError(state, "role")}>
            {(control) => (
              <NativeSelect {...control} defaultValue={role}>
                {ASSIGNABLE_ROLES.map((option) => (
                  <option key={option} value={option}>
                    {USER_ROLE_LABELS[option]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>

          <Field
            name="reason"
            label="Why?"
            required
            hint="Stored in the audit log against both the old and the new role."
            error={fieldError(state, "reason")}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={3}
                placeholder="Joined the BuildLink support team on 14 August."
              />
            )}
          </Field>

          <Alert tone="warning" hideIcon>
            The supplier and transporter roles need a registered business first. If there is none,
            this will be refused rather than leaving them on an empty console.
          </Alert>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Saving…">Change role</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
