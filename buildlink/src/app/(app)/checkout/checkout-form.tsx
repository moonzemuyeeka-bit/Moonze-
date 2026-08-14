"use client";

import * as React from "react";
import { useActionState } from "react";
import { Info } from "lucide-react";
import { Field, FieldRow } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { LocationSelect } from "@/components/forms/location-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, fieldError } from "@/components/forms/form-message";
import { Alert } from "@/components/ui/alert";
import { placeOrderAction, type CheckoutActionState } from "@/server/orders/actions";
import type { ProvinceOption } from "@/server/reference/queries";
import type { FulfilmentMethod } from "@prisma/client";

/**
 * Checkout form.
 *
 * It posts choices only — which supplier delivers, where to, who receives it.
 * Every price is recomputed on the server from the cart, so a tampered form
 * cannot buy cement at a price the supplier never set.
 */
export function CheckoutForm({
  provinces,
  projects,
  fulfilment,
  needsAddress,
  defaults,
  projectId,
}: {
  provinces: ProvinceOption[];
  projects: Array<{ id: string; name: string }>;
  fulfilment: Record<string, FulfilmentMethod>;
  needsAddress: boolean;
  defaults: {
    contactName: string;
    contactPhone: string;
    provinceId: string | null;
    districtId: string | null;
    locationDetail: string | null;
  };
  projectId: string | null;
}) {
  const [state, formAction] = useActionState<CheckoutActionState, FormData>(
    placeOrderAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-6">
      {Object.entries(fulfilment).map(([supplierId, method]) => (
        <input
          key={supplierId}
          type="hidden"
          name="fulfilment"
          value={`${supplierId}:${method}`}
        />
      ))}

      <FormMessage state={state} />

      {needsAddress ? (
        <div className="space-y-4">
          <Field
            name="addressLine"
            label="Delivery address"
            required
            hint="Street, plot number or a description a driver can find."
            error={fieldError(state, "addressLine")}
          >
            {(control) => (
              <Input
                {...control}
                autoComplete="street-address"
                placeholder="Plot 4521, Chalala, off Joseph Mwilwa Road"
              />
            )}
          </Field>

          <LocationSelect
            provinces={provinces}
            defaultProvinceId={defaults.provinceId}
            defaultDistrictId={defaults.districtId}
            provinceError={fieldError(state, "provinceId")}
            districtError={fieldError(state, "districtId")}
            districtRequired
          />

          <Field
            name="locationDetail"
            label="Area or landmark"
            hint="Optional, but it saves a phone call on delivery day."
            error={fieldError(state, "locationDetail")}
          >
            {(control) => <Input {...control} placeholder="Near Chalala Police Post" />}
          </Field>
        </div>
      ) : (
        <Alert tone="info" title="Collection only">
          You have chosen to collect everything yourself, so no delivery address is needed. Each
          supplier will confirm when your materials are ready.
        </Alert>
      )}

      <FieldRow>
        <Field
          name="contactName"
          label="Who receives the materials?"
          required
          error={fieldError(state, "contactName")}
        >
          {(control) => (
            <Input {...control} defaultValue={defaults.contactName} autoComplete="name" />
          )}
        </Field>
        <Field
          name="contactPhone"
          label="Their mobile number"
          required
          hint="The supplier or driver will call this number."
          error={fieldError(state, "contactPhone")}
        >
          {(control) => (
            <Input
              {...control}
              type="tel"
              inputMode="tel"
              defaultValue={defaults.contactPhone}
              placeholder="0977 123 456"
            />
          )}
        </Field>
      </FieldRow>

      <Field
        name="instructions"
        label="Delivery instructions"
        hint="Access, offloading, gate code — anything the driver should know."
        error={fieldError(state, "instructions")}
      >
        {(control) => (
          <Textarea
            {...control}
            rows={3}
            placeholder="Call when you reach the gate. Offload inside the yard, not on the road."
          />
        )}
      </Field>

      {projects.length > 0 ? (
        <Field
          name="projectId"
          label="Attach to a project"
          hint="The order's value is added to that project's spending and wallet automatically."
          error={fieldError(state, "projectId")}
        >
          {(control) => (
            <NativeSelect {...control} defaultValue={projectId ?? ""}>
              <option value="">Do not attach to a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
      ) : (
        <input type="hidden" name="projectId" value="" />
      )}

      <Field
        name="customerNote"
        label="Note for the supplier"
        error={fieldError(state, "customerNote")}
      >
        {(control) => (
          <Textarea {...control} rows={2} placeholder="Please confirm the cement is fresh stock." />
        )}
      </Field>

      <div className="space-y-3 rounded-xl border border-border bg-surface-muted p-4">
        <p className="flex items-start gap-2 text-sm text-foreground">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-700" />
          <span>
            Placing the order sends each supplier an agreement to accept. You pay after that —
            directly to the supplier, or online where a provider is available. BuildLink records
            the payment; it never holds your money.
          </span>
        </p>
      </div>

      <SubmitButton size="lg" block pendingText="Placing your order…">
        Place order
      </SubmitButton>
    </form>
  );
}
