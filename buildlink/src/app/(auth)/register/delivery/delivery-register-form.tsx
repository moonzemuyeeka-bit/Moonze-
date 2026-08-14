"use client";

import * as React from "react";
import Link from "next/link";
import { Field, FieldRow, FieldSet } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { CheckboxField, RadioCard, RadioGroup } from "@/components/ui/controls";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, fieldError } from "@/components/forms/form-message";
import { registerDeliveryProviderAction, type AuthActionState } from "@/server/auth/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-policy";
import type { ProvinceOption } from "@/server/reference/queries";

export function DeliveryRegisterForm({ provinces }: { provinces: ProvinceOption[] }) {
  const [state, formAction] = React.useActionState<AuthActionState, FormData>(
    registerDeliveryProviderAction,
    null,
  );
  const [type, setType] = React.useState("INDEPENDENT_DRIVER");
  const [acceptTerms, setAcceptTerms] = React.useState(false);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormMessage state={state} />

      <FieldSet legend="What kind of operation are you?" error={fieldError(state, "type")}>
        <RadioGroup value={type} onValueChange={setType} name="type" className="grid gap-3">
          <RadioCard
            id="type-independent"
            value="INDEPENDENT_DRIVER"
            title="Independent driver"
            description="You own or drive one or two vehicles and take delivery jobs yourself."
          />
          <RadioCard
            id="type-company"
            value="LOGISTICS_COMPANY"
            title="Logistics company"
            description="You run a fleet and dispatch drivers to jobs."
          />
        </RadioGroup>
      </FieldSet>

      <Field
        name="businessName"
        label="Business or trading name"
        error={fieldError(state, "businessName")}
        required
      >
        {(control) => <Input {...control} placeholder="Mulenga Haulage" />}
      </Field>

      <Field
        name="description"
        label="What can you carry?"
        hint="Vehicle types, capacity and the areas you cover. You can add vehicles and service areas after registering."
        error={fieldError(state, "description")}
      >
        {(control) => (
          <Textarea
            {...control}
            rows={3}
            placeholder="Two 10-tonne tipper trucks covering Lusaka and Chongwe. Sand, stone and blocks."
          />
        )}
      </Field>

      <Field
        name="provinceId"
        label="Main province you serve"
        hint="You can add more service areas later."
        error={fieldError(state, "provinceId")}
        required
      >
        {(control) => (
          <NativeSelect {...control} defaultValue="">
            <option value="">Select a province</option>
            {provinces.map((province) => (
              <option key={province.id} value={province.id}>
                {province.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <div className="space-y-5 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">Your login</h2>

        <FieldRow>
          <Field
            name="contactName"
            label="Contact person"
            error={fieldError(state, "contactName")}
            required
          >
            {(control) => <Input {...control} autoComplete="name" placeholder="Chanda Mulenga" />}
          </Field>
          <Field name="phone" label="Mobile number" error={fieldError(state, "phone")} required>
            {(control) => (
              <Input {...control} type="tel" inputMode="tel" autoComplete="tel" placeholder="0977 123 456" />
            )}
          </Field>
        </FieldRow>

        <Field name="email" label="Email address" error={fieldError(state, "email")} required>
          {(control) => (
            <Input {...control} type="email" inputMode="email" autoComplete="email" />
          )}
        </Field>

        <FieldRow>
          <Field
            name="password"
            label="Password"
            hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
            error={fieldError(state, "password")}
            required
          >
            {(control) => <Input {...control} type="password" autoComplete="new-password" />}
          </Field>
          <Field
            name="confirmPassword"
            label="Confirm password"
            error={fieldError(state, "confirmPassword")}
            required
          >
            {(control) => <Input {...control} type="password" autoComplete="new-password" />}
          </Field>
        </FieldRow>
      </div>

      <div className="space-y-4 border-t border-border pt-6">
        <div className="space-y-2">
          <CheckboxField
            id="acceptTerms"
            checked={acceptTerms}
            onCheckedChange={(checked) => setAcceptTerms(checked === true)}
            label="The details above are accurate"
            description="Delivery providers show as pending verification until BuildLink reviews their details."
          />
          {fieldError(state, "acceptTerms") ? (
            <p className="text-xs text-danger-700">{fieldError(state, "acceptTerms")?.join(" ")}</p>
          ) : null}
          <input type="hidden" name="acceptTerms" value={acceptTerms ? "on" : ""} />
        </div>

        <SubmitButton block size="lg" pendingText="Creating your account…">
          Register as a delivery provider
        </SubmitButton>

        <p className="text-center text-sm text-foreground-muted">
          Already registered?{" "}
          <Link href="/login" className="font-medium text-brand-700 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </form>
  );
}
