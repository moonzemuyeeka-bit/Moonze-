"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { Field, FieldRow } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { CheckboxField } from "@/components/ui/controls";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, fieldError } from "@/components/forms/form-message";
import {
  saveProviderSettingsAction,
  type ProviderSettingsActionState,
} from "@/server/delivery/actions";
import { toKwacha } from "@/lib/money";

/**
 * Transport business settings.
 *
 * "Accepting jobs" is the switch a driver reaches for when their truck is in the
 * workshop, so it sits with the rest of the details rather than being buried.
 */
export function ProviderSettingsForm({
  provider,
}: {
  provider: {
    businessName: string;
    phone: string;
    description: string | null;
    baseFeeMinor: number;
    perKilometreMinor: number;
    isAcceptingJobs: boolean;
  };
}) {
  const [state, formAction] = useActionState<ProviderSettingsActionState, FormData>(
    saveProviderSettingsAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-5">
      <FormMessage state={state} successMessage="Your details are saved." />

      <FieldRow>
        <Field
          name="businessName"
          label="Business name"
          required
          error={fieldError(state, "businessName")}
        >
          {(control) => <Input {...control} defaultValue={provider.businessName} />}
        </Field>

        <Field
          name="phone"
          label="Phone number"
          required
          hint="Suppliers and customers call this number about a job."
          error={fieldError(state, "phone")}
        >
          {(control) => (
            <Input {...control} type="tel" inputMode="tel" defaultValue={provider.phone} />
          )}
        </Field>
      </FieldRow>

      <Field
        name="description"
        label="What do you carry?"
        hint="Shown to suppliers choosing a transporter."
        error={fieldError(state, "description")}
      >
        {(control) => (
          <Textarea
            {...control}
            rows={3}
            defaultValue={provider.description ?? ""}
            placeholder="Sand, stone and cement around Lusaka and Kafue. Two tippers and a flatbed."
          />
        )}
      </Field>

      <FieldRow>
        <Field
          name="baseFeeMinor"
          label="Base fee (ZMW)"
          hint="What you charge before distance."
          error={fieldError(state, "baseFeeMinor")}
        >
          {(control) => (
            <Input
              {...control}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              defaultValue={toKwacha(provider.baseFeeMinor)}
            />
          )}
        </Field>

        <Field
          name="perKilometreMinor"
          label="Rate per kilometre (ZMW)"
          error={fieldError(state, "perKilometreMinor")}
        >
          {(control) => (
            <Input
              {...control}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              defaultValue={toKwacha(provider.perKilometreMinor)}
            />
          )}
        </Field>
      </FieldRow>

      <CheckboxField
        id="isAcceptingJobs"
        name="isAcceptingJobs"
        label="I am accepting delivery jobs"
        description="Turn this off while your vehicles are unavailable. Jobs already yours are unaffected."
        defaultChecked={provider.isAcceptingJobs}
      />

      <SubmitButton pendingText="Saving…">
        <Save aria-hidden />
        Save settings
      </SubmitButton>
    </form>
  );
}
