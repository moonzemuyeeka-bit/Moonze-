"use client";

import * as React from "react";
import { useActionState } from "react";
import { Save } from "lucide-react";
import { Field, FieldRow, FieldSet } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { CheckboxField } from "@/components/ui/controls";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, fieldError } from "@/components/forms/form-message";
import { LocationSelect } from "@/components/forms/location-select";
import {
  saveSupplierSettingsAction,
  type SupplierActionState,
} from "@/server/suppliers/actions";
import { toKwacha } from "@/lib/money";
import type { CategoryOption, ProvinceOption } from "@/server/reference/queries";

export type SupplierSettingsValues = {
  businessName: string;
  description: string | null;
  phone: string;
  email: string;
  provinceId: string;
  districtId: string | null;
  address: string | null;
  yearsOperating: number | null;
  registrationNumber: string | null;
  taxpayerNumber: string | null;
  deliveryAvailable: boolean;
  deliveryNotes: string | null;
  minimumOrderMinor: number;
  deliveryBaseFeeMinor: number;
  deliveryFreeAboveMinor: number | null;
  categoryIds: string[];
};

/**
 * Business settings.
 *
 * Grouped the way a supplier thinks about their business — who we are, where we
 * are, what we sell, how we deliver — rather than by which table the column
 * lives in. The delivery block is disclosed only when the supplier says they
 * deliver, because a fee and a free-delivery threshold mean nothing otherwise.
 */
export function SupplierSettingsForm({
  provinces,
  categories,
  supplier,
}: {
  provinces: ProvinceOption[];
  categories: CategoryOption[];
  supplier: SupplierSettingsValues;
}) {
  const [state, formAction] = useActionState<SupplierActionState, FormData>(
    saveSupplierSettingsAction,
    null,
  );
  const [deliveryAvailable, setDeliveryAvailable] = React.useState(supplier.deliveryAvailable);
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>(
    supplier.categoryIds,
  );

  function toggleCategory(id: string, checked: boolean) {
    setSelectedCategories((current) =>
      checked ? [...new Set([...current, id])] : current.filter((value) => value !== id),
    );
  }

  return (
    <form action={formAction} className="space-y-8">
      <FormMessage state={state} successMessage="Your business details are saved." />

      <section className="space-y-5">
        <h2 className="text-base font-semibold text-foreground">Your business</h2>

        <Field
          name="businessName"
          label="Business name"
          required
          hint="Exactly as customers should see it, and as it appears on your registration."
          error={fieldError(state, "businessName")}
        >
          {(control) => <Input {...control} defaultValue={supplier.businessName} />}
        </Field>

        <Field
          name="description"
          label="What do you supply?"
          hint="The first thing a customer reads on your profile. Say what you stock and where you cover."
          error={fieldError(state, "description")}
        >
          {(control) => (
            <Textarea
              {...control}
              rows={4}
              defaultValue={supplier.description ?? ""}
              placeholder="Cement, blocks and roofing sheets across Lusaka and Chongwe since 2015. Own delivery within 40 km."
            />
          )}
        </Field>

        <FieldRow>
          <Field
            name="phone"
            label="Phone number"
            required
            hint="Customers call this number about an order."
            error={fieldError(state, "phone")}
          >
            {(control) => (
              <Input {...control} type="tel" inputMode="tel" defaultValue={supplier.phone} />
            )}
          </Field>

          <Field name="email" label="Business email" required error={fieldError(state, "email")}>
            {(control) => (
              <Input {...control} type="email" inputMode="email" defaultValue={supplier.email} />
            )}
          </Field>
        </FieldRow>

        <FieldRow>
          <Field
            name="yearsOperating"
            label="Years in business"
            error={fieldError(state, "yearsOperating")}
          >
            {(control) => (
              <Input
                {...control}
                type="number"
                min="0"
                max="150"
                step="1"
                inputMode="numeric"
                defaultValue={supplier.yearsOperating ?? ""}
              />
            )}
          </Field>

          <Field
            name="registrationNumber"
            label="PACRA registration number"
            hint="Changing this sends your registration back for verification."
            error={fieldError(state, "registrationNumber")}
          >
            {(control) => (
              <Input {...control} defaultValue={supplier.registrationNumber ?? ""} />
            )}
          </Field>
        </FieldRow>

        <Field
          name="taxpayerNumber"
          label="TPIN"
          hint="Used for verification and invoicing. Never shown to customers."
          error={fieldError(state, "taxpayerNumber")}
          className="sm:max-w-sm"
        >
          {(control) => <Input {...control} defaultValue={supplier.taxpayerNumber ?? ""} />}
        </Field>
      </section>

      <section className="space-y-5 border-t border-border pt-6">
        <h2 className="text-base font-semibold text-foreground">Where you trade from</h2>

        <LocationSelect
          provinces={provinces}
          defaultProvinceId={supplier.provinceId}
          defaultDistrictId={supplier.districtId}
          provinceError={fieldError(state, "provinceId")}
          districtError={fieldError(state, "districtId")}
        />

        <Field
          name="address"
          label="Yard or shop address"
          hint="Where a customer collecting goods should go."
          error={fieldError(state, "address")}
        >
          {(control) => (
            <Input
              {...control}
              defaultValue={supplier.address ?? ""}
              placeholder="Plot 123, Freedom Way, Industrial Area"
            />
          )}
        </Field>
      </section>

      <section className="space-y-5 border-t border-border pt-6">
        <h2 className="text-base font-semibold text-foreground">What you supply</h2>

        <FieldSet
          legend="Categories"
          hint="Customers filter by category, so choose every one you genuinely stock — and none you do not."
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

        <Field
          name="minimumOrderMinor"
          label="Minimum order value (ZMW)"
          hint="Leave at 0 if you have no minimum. Customers see this before they add to the cart."
          error={fieldError(state, "minimumOrderMinor")}
          className="sm:max-w-xs"
        >
          {(control) => (
            <Input
              {...control}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              defaultValue={toKwacha(supplier.minimumOrderMinor)}
            />
          )}
        </Field>
      </section>

      <section className="space-y-5 border-t border-border pt-6">
        <h2 className="text-base font-semibold text-foreground">Delivery</h2>

        <div>
          <CheckboxField
            id="deliveryAvailable"
            checked={deliveryAvailable}
            onCheckedChange={(checked) => setDeliveryAvailable(checked === true)}
            label="We deliver to customers"
            description="Turn this off if every order is collected, or carried by a transporter the customer arranges."
          />
          <input type="hidden" name="deliveryAvailable" value={deliveryAvailable ? "on" : ""} />
        </div>

        {deliveryAvailable ? (
          <div className="space-y-5 rounded-xl border border-border bg-surface-muted/40 p-4">
            <FieldRow>
              <Field
                name="deliveryBaseFeeMinor"
                label="Delivery fee (ZMW)"
                hint="Your usual charge. Quoted to the customer at checkout."
                error={fieldError(state, "deliveryBaseFeeMinor")}
              >
                {(control) => (
                  <Input
                    {...control}
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    defaultValue={toKwacha(supplier.deliveryBaseFeeMinor)}
                  />
                )}
              </Field>

              <Field
                name="deliveryFreeAboveMinor"
                label="Free above (ZMW)"
                hint="Order value at which you deliver free of charge. Leave blank if you always charge."
                error={fieldError(state, "deliveryFreeAboveMinor")}
              >
                {(control) => (
                  <Input
                    {...control}
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    defaultValue={
                      supplier.deliveryFreeAboveMinor === null
                        ? ""
                        : toKwacha(supplier.deliveryFreeAboveMinor)
                    }
                  />
                )}
              </Field>
            </FieldRow>

            <Field
              name="deliveryNotes"
              label="Anything a customer should know?"
              error={fieldError(state, "deliveryNotes")}
            >
              {(control) => (
                <Textarea
                  {...control}
                  rows={3}
                  defaultValue={supplier.deliveryNotes ?? ""}
                  placeholder="Deliveries Monday to Saturday, 07:00–17:00. Beyond 40 km we quote per trip."
                />
              )}
            </Field>
          </div>
        ) : (
          <>
            <input type="hidden" name="deliveryBaseFeeMinor" value="0" />
            <input type="hidden" name="deliveryFreeAboveMinor" value="" />
            <input type="hidden" name="deliveryNotes" value={supplier.deliveryNotes ?? ""} />
          </>
        )}
      </section>

      <div className="border-t border-border pt-6">
        <SubmitButton pendingText="Saving…">
          <Save aria-hidden />
          Save settings
        </SubmitButton>
      </div>
    </form>
  );
}
