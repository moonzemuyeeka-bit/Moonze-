"use client";

import * as React from "react";
import { useActionState } from "react";
import { Plus } from "lucide-react";
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
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, fieldError } from "@/components/forms/form-message";
import {
  retireVehicleAction,
  saveVehicleAction,
  type VehicleActionState,
} from "@/server/delivery/actions";
import { VEHICLE_TYPES, VEHICLE_TYPE_LABELS } from "@/lib/labels";
import type { VehicleType } from "@prisma/client";

/**
 * Fleet management.
 *
 * The same dialog adds and edits, because the fields are identical and a
 * transporter with three trucks should not have to learn two screens.
 */

export type VehicleDraft = {
  id: string;
  type: VehicleType;
  registration: string;
  description: string | null;
  capacityKg: number | null;
  capacityCubicMetres: number | null;
};

export function VehicleDialog({
  vehicle,
  trigger,
}: {
  vehicle?: VehicleDraft;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState<VehicleActionState, FormData>(saveVehicleAction, null);

  React.useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus aria-hidden />
            Add a vehicle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vehicle ? "Edit vehicle" : "Add a vehicle"}</DialogTitle>
          <DialogDescription>
            Customers and suppliers see the type and registration of the vehicle bringing their
            materials.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {vehicle ? <input type="hidden" name="vehicleId" value={vehicle.id} /> : null}
          <FormMessage state={state} />

          <FieldRow>
            <Field name="type" label="Vehicle type" required error={fieldError(state, "type")}>
              {(control) => (
                <NativeSelect {...control} defaultValue={vehicle?.type ?? "LIGHT_TRUCK"}>
                  {VEHICLE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {VEHICLE_TYPE_LABELS[type]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>

            <Field
              name="registration"
              label="Registration"
              required
              error={fieldError(state, "registration")}
            >
              {(control) => (
                <Input
                  {...control}
                  defaultValue={vehicle?.registration ?? ""}
                  placeholder="BAH 1234"
                  autoCapitalize="characters"
                />
              )}
            </Field>
          </FieldRow>

          <FieldRow>
            <Field
              name="capacityKg"
              label="Load capacity (kg)"
              error={fieldError(state, "capacityKg")}
            >
              {(control) => (
                <Input
                  {...control}
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  defaultValue={vehicle?.capacityKg ?? ""}
                  placeholder="3000"
                />
              )}
            </Field>

            <Field
              name="capacityCubicMetres"
              label="Volume (m³)"
              error={fieldError(state, "capacityCubicMetres")}
            >
              {(control) => (
                <Input
                  {...control}
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  defaultValue={vehicle?.capacityCubicMetres ?? ""}
                  placeholder="6"
                />
              )}
            </Field>
          </FieldRow>

          <Field
            name="description"
            label="Anything else worth knowing?"
            error={fieldError(state, "description")}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={2}
                defaultValue={vehicle?.description ?? ""}
                placeholder="Tipper with a tarpaulin — suitable for sand and stone."
              />
            )}
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Saving…">
              {vehicle ? "Save changes" : "Add vehicle"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Retiring rather than deleting: past deliveries name the vehicle that carried
 * them, so a truck that has left the fleet is deactivated, not erased.
 */
export function ToggleVehicleForm({
  vehicleId,
  isActive,
}: {
  vehicleId: string;
  isActive: boolean;
}) {
  const [state, formAction] = useActionState<VehicleActionState, FormData>(
    retireVehicleAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <FormMessage state={state} />
      <SubmitButton size="sm" variant="ghost" pendingText="Saving…">
        {isActive ? "Take out of service" : "Return to service"}
      </SubmitButton>
    </form>
  );
}
