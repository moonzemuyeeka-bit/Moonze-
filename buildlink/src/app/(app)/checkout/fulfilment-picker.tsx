"use client";

import * as React from "react";
import { Truck, PackageCheck, Store } from "lucide-react";
import { RadioGroup, RadioCard } from "@/components/ui/controls";
import { Button } from "@/components/ui/button";
import { formatZmw } from "@/lib/money";
import type { FulfilmentMethod } from "@prisma/client";

/**
 * Per-supplier fulfilment choice.
 *
 * A GET form rather than client-side state, because the delivery fee for each
 * choice is the server's decision (each supplier has its own fee and
 * free-delivery threshold) and duplicating that arithmetic in the browser is how
 * a customer ends up seeing one total and being charged another. Changing a
 * radio re-requests the page with the new selection; the submit button keeps it
 * working when JavaScript does not.
 */
export function FulfilmentPicker({
  suppliers,
  projectId,
}: {
  suppliers: Array<{
    id: string;
    businessName: string;
    method: FulfilmentMethod;
    deliveryAvailable: boolean;
    deliveryFeeMinor: number;
    subtotalMinor: number;
    freeDeliveryAboveMinor: number | null;
    location: string;
  }>;
  projectId: string | null;
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [selection, setSelection] = React.useState<Record<string, FulfilmentMethod>>(() =>
    Object.fromEntries(suppliers.map((supplier) => [supplier.id, supplier.method])),
  );

  function choose(supplierId: string, method: FulfilmentMethod) {
    setSelection((current) => ({ ...current, [supplierId]: method }));
    // Let React commit the new radio value before the form is serialised.
    window.requestAnimationFrame(() => formRef.current?.requestSubmit());
  }

  return (
    <form ref={formRef} method="get" action="/checkout" className="space-y-5">
      {projectId ? <input type="hidden" name="projectId" value={projectId} /> : null}

      {suppliers.map((supplier) => {
        const chosen = selection[supplier.id] ?? supplier.method;
        return (
          <fieldset key={supplier.id} className="space-y-2">
            <legend className="text-sm font-semibold text-foreground">
              {supplier.businessName}
              <span className="ml-2 font-normal text-foreground-muted">{supplier.location}</span>
            </legend>

            <RadioGroup
              name="fulfilment"
              value={`${supplier.id}:${chosen}`}
              onValueChange={(value) => {
                const method = value.slice(value.lastIndexOf(":") + 1) as FulfilmentMethod;
                choose(supplier.id, method);
              }}
              className="grid gap-2 sm:grid-cols-3"
            >
              <RadioCard
                id={`${supplier.id}-supplier-delivery`}
                value={`${supplier.id}:SUPPLIER_DELIVERY`}
                title="Supplier delivers"
                icon={<Truck aria-hidden className="size-4" />}
                disabled={!supplier.deliveryAvailable}
                description={
                  supplier.deliveryAvailable
                    ? deliveryFeeDescription(supplier)
                    : "This supplier does not deliver"
                }
              />
              <RadioCard
                id={`${supplier.id}-third-party`}
                value={`${supplier.id}:THIRD_PARTY_DELIVERY`}
                title="Arrange a transporter"
                icon={<PackageCheck aria-hidden className="size-4" />}
                description="Quoted by the transporter after the order is placed"
              />
              <RadioCard
                id={`${supplier.id}-pickup`}
                value={`${supplier.id}:CUSTOMER_PICKUP`}
                title="I will collect"
                icon={<Store aria-hidden className="size-4" />}
                description="No delivery fee"
              />
            </RadioGroup>
          </fieldset>
        );
      })}

      <Button type="submit" variant="outline" size="sm">
        Update totals
      </Button>
    </form>
  );
}

function deliveryFeeDescription(supplier: {
  deliveryFeeMinor: number;
  subtotalMinor: number;
  freeDeliveryAboveMinor: number | null;
}): string {
  if (supplier.deliveryFeeMinor === 0) {
    return supplier.freeDeliveryAboveMinor !== null &&
      supplier.subtotalMinor >= supplier.freeDeliveryAboveMinor
      ? "Free — this basket passes the supplier's free-delivery threshold"
      : "Free delivery";
  }
  const base = `${formatZmw(supplier.deliveryFeeMinor)} delivery`;
  return supplier.freeDeliveryAboveMinor !== null
    ? `${base}, free above ${formatZmw(supplier.freeDeliveryAboveMinor)}`
    : base;
}
