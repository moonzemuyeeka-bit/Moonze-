"use client";

import { useActionState } from "react";
import { Truck } from "lucide-react";
import { NativeSelect } from "@/components/ui/input";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import { claimDeliveryAction, type DeliveryActionState } from "@/server/delivery/actions";
import { VEHICLE_TYPE_LABELS } from "@/lib/labels";
import type { VehicleType } from "@prisma/client";

/**
 * Taking a job off the board.
 *
 * Two transporters can tap the same job at the same moment; the action settles
 * that with a conditional update, so this only has to report the outcome.
 */
export function ClaimJobForm({
  deliveryId,
  vehicles,
}: {
  deliveryId: string;
  vehicles: Array<{ id: string; type: VehicleType; registration: string }>;
}) {
  const [state, formAction] = useActionState<DeliveryActionState, FormData>(
    claimDeliveryAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="deliveryId" value={deliveryId} />
      <FormMessage state={state} />

      {vehicles.length > 0 ? (
        <NativeSelect
          name="vehicleId"
          aria-label="Vehicle for this job"
          defaultValue=""
          className="h-10"
        >
          <option value="">Choose a vehicle later</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {VEHICLE_TYPE_LABELS[vehicle.type]} · {vehicle.registration}
            </option>
          ))}
        </NativeSelect>
      ) : null}

      <SubmitButton block pendingText="Taking the job…">
        <Truck aria-hidden />
        Take this job
      </SubmitButton>
    </form>
  );
}
