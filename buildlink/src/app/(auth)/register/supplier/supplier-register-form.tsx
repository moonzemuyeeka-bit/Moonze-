"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Field, FieldRow, FieldSet } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/controls";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, fieldError } from "@/components/forms/form-message";
import { LocationSelect } from "@/components/forms/location-select";
import { registerSupplierAction, type AuthActionState } from "@/server/auth/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-policy";
import type { CategoryOption, ProvinceOption } from "@/server/reference/queries";

export function SupplierRegisterForm({
  provinces,
  categories,
}: {
  provinces: ProvinceOption[];
  categories: CategoryOption[];
}) {
  const [state, formAction] = React.useActionState<AuthActionState, FormData>(
    registerSupplierAction,
    null,
  );
  const [showPassword, setShowPassword] = React.useState(false);
  const [acceptTerms, setAcceptTerms] = React.useState(false);
  const [deliveryAvailable, setDeliveryAvailable] = React.useState(false);
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);

  function toggleCategory(id: string, checked: boolean) {
    setSelectedCategories((current) =>
      checked ? [...new Set([...current, id])] : current.filter((value) => value !== id),
    );
  }

  return (
    <form action={formAction} className="space-y-8" noValidate>
      <FormMessage state={state} />

      <section className="space-y-5">
        <h2 className="text-lg font-semibold">Your business</h2>

        <Field
          name="businessName"
          label="Business name"
          error={fieldError(state, "businessName")}
          required
        >
          {(control) => <Input {...control} placeholder="Kabwe Building Supplies" autoFocus />}
        </Field>

        <Field
          name="description"
          label="What do you supply?"
          hint="A short description customers will see on your profile."
          error={fieldError(state, "description")}
        >
          {(control) => (
            <Textarea
              {...control}
              rows={3}
              placeholder="Cement, blocks and roofing sheets, supplied across Central Province since 2015."
            />
          )}
        </Field>

        <LocationSelect
          provinces={provinces}
          provinceError={fieldError(state, "provinceId")}
          districtError={fieldError(state, "districtId")}
        />

        <Field name="address" label="Yard or shop address" error={fieldError(state, "address")}>
          {(control) => <Input {...control} placeholder="Plot 123, Freedom Way, Industrial Area" />}
        </Field>

        <FieldSet
          legend="Categories you supply"
          hint="Choose every category you stock. Customers filter by these."
          error={fieldError(state, "categoryIds")}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {categories.map((category) => (
              <label
                key={category.id}
                className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-3 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
              >
                <input
                  type="checkbox"
                  name="categoryIds"
                  value={category.id}
                  checked={selectedCategories.includes(category.id)}
                  onChange={(event) => toggleCategory(category.id, event.target.checked)}
                  className="mt-0.5 size-4 rounded border-border-strong text-brand-700"
                />
                <span className="text-sm font-medium text-foreground">{category.name}</span>
              </label>
            ))}
          </div>
        </FieldSet>

        <FieldRow>
          <Field
            name="yearsOperating"
            label="Years in business"
            error={fieldError(state, "yearsOperating")}
          >
            {(control) => (
              <Input {...control} type="number" min={0} max={150} inputMode="numeric" placeholder="8" />
            )}
          </Field>
          <Field
            name="registrationNumber"
            label="PACRA registration number"
            hint="Optional now — required for verification."
            error={fieldError(state, "registrationNumber")}
          >
            {(control) => <Input {...control} placeholder="120180000123" />}
          </Field>
        </FieldRow>

        <Field
          name="taxpayerNumber"
          label="TPIN"
          hint="Optional. Used for verification and invoicing only."
          error={fieldError(state, "taxpayerNumber")}
        >
          {(control) => <Input {...control} placeholder="1002345678" />}
        </Field>

        <div>
          <CheckboxField
            id="deliveryAvailable"
            checked={deliveryAvailable}
            onCheckedChange={(checked) => setDeliveryAvailable(checked === true)}
            label="We deliver to customers"
            description="You can set your delivery fee and free-delivery threshold later in your console."
          />
          <input type="hidden" name="deliveryAvailable" value={deliveryAvailable ? "on" : ""} />
        </div>
      </section>

      <section className="space-y-5 border-t border-border pt-6">
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
          <Field
            name="phone"
            label="Mobile number"
            error={fieldError(state, "phone")}
            required
          >
            {(control) => (
              <Input {...control} type="tel" inputMode="tel" autoComplete="tel" placeholder="0977 123 456" />
            )}
          </Field>
        </FieldRow>

        <Field name="email" label="Business email" error={fieldError(state, "email")} required>
          {(control) => (
            <Input
              {...control}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="sales@yourbusiness.co.zm"
            />
          )}
        </Field>

        <Field
          name="password"
          label="Password"
          hint={`At least ${PASSWORD_MIN_LENGTH} characters, including a number.`}
          error={fieldError(state, "password")}
          required
        >
          {(control) => (
            <div className="relative">
              <Input
                {...control}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className="pr-11"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-1 top-1"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          )}
        </Field>

        <Field
          name="confirmPassword"
          label="Confirm password"
          error={fieldError(state, "confirmPassword")}
          required
        >
          {(control) => (
            <Input {...control} type={showPassword ? "text" : "password"} autoComplete="new-password" />
          )}
        </Field>
      </section>

      <div className="space-y-4 border-t border-border pt-6">
        <div className="space-y-2">
          <CheckboxField
            id="acceptTerms"
            checked={acceptTerms}
            onCheckedChange={(checked) => setAcceptTerms(checked === true)}
            label="The details above are accurate"
            description="Your business will show as pending verification until BuildLink has reviewed your documents. Misrepresenting a business is grounds for removal."
          />
          {fieldError(state, "acceptTerms") ? (
            <p className="text-xs text-danger-700">{fieldError(state, "acceptTerms")?.join(" ")}</p>
          ) : null}
          <input type="hidden" name="acceptTerms" value={acceptTerms ? "on" : ""} />
        </div>

        <SubmitButton block size="lg" pendingText="Registering your business…">
          Register my business
        </SubmitButton>

        <p className="text-center text-sm text-foreground-muted">
          Already registered?{" "}
          <Link href="/login" className="font-medium text-brand-700 hover:underline">
            Sign in to your console
          </Link>
        </p>
      </div>
    </form>
  );
}
