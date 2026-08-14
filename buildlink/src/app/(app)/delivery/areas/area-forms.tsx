"use client";

import { useActionState } from "react";
import { MapPinPlus, Trash2 } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LocationSelect } from "@/components/forms/location-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, fieldError } from "@/components/forms/form-message";
import {
  removeServiceAreaAction,
  saveServiceAreaAction,
  type ServiceAreaActionState,
} from "@/server/delivery/actions";
import type { ProvinceOption } from "@/server/reference/queries";

/**
 * Service areas.
 *
 * Leaving the district blank means "anywhere in this province", which is how most
 * independent drivers actually work. Saving the same area twice updates its fee
 * rather than creating a duplicate.
 */
export function ServiceAreaForm({ provinces }: { provinces: ProvinceOption[] }) {
  const [state, formAction] = useActionState<ServiceAreaActionState, FormData>(
    saveServiceAreaAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} successMessage="Service area saved." />

      <LocationSelect
        provinces={provinces}
        provinceError={fieldError(state, "provinceId")}
        districtError={fieldError(state, "districtId")}
        labels={{ province: "Province you cover", district: "District (optional)" }}
      />

      <Field
        name="feeMinor"
        label="Typical fee for this area (ZMW)"
        hint="A guide price. The supplier can set a different fee when they assign you a job."
        error={fieldError(state, "feeMinor")}
      >
        {(control) => (
          <Input
            {...control}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            defaultValue="0"
          />
        )}
      </Field>

      <SubmitButton pendingText="Saving…">
        <MapPinPlus aria-hidden />
        Save service area
      </SubmitButton>
    </form>
  );
}

export function RemoveServiceAreaForm({ serviceAreaId }: { serviceAreaId: string }) {
  const [state, formAction] = useActionState<ServiceAreaActionState, FormData>(
    removeServiceAreaAction,
    null,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="serviceAreaId" value={serviceAreaId} />
      <FormMessage state={state} />
      <SubmitButton size="sm" variant="ghost" pendingText="Removing…">
        <Trash2 aria-hidden />
        Remove
      </SubmitButton>
    </form>
  );
}
