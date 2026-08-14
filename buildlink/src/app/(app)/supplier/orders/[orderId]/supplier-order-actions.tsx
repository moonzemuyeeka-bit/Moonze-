"use client";

import * as React from "react";
import { useActionState } from "react";
import { ArrowRight, Ban, CheckCircle2, PackageX, Truck } from "lucide-react";
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
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, fieldError } from "@/components/forms/form-message";
import {
  cancelOrderAction,
  updateOrderStatusAction,
  type OrderActionState,
} from "@/server/orders/actions";
import {
  assignDeliveryAction,
  completeDeliveryAction,
  failDeliveryAction,
  type DeliveryActionState,
} from "@/server/delivery/actions";
import { formatZmw, toKwacha } from "@/lib/money";
import { DELIVERY_PROVIDER_TYPE_LABELS, VEHICLE_TYPE_LABELS } from "@/lib/labels";
import type { OrderStatus } from "@prisma/client";

/**
 * Supplier order controls.
 *
 * The common case is one tap: confirm the order, start preparing, mark it ready.
 * Anything that changes what the customer is owed — a cancellation, signing for
 * goods, handing the load to a transporter — asks for the detail that makes the
 * record worth having.
 */

export function AdvanceOrderForm({
  orderId,
  to,
  label,
}: {
  orderId: string;
  to: OrderStatus;
  label: string;
}) {
  const [state, formAction] = useActionState<OrderActionState, FormData>(
    updateOrderStatusAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="status" value={to} />
      <FormMessage state={state} />
      <SubmitButton block pendingText="Saving…">
        {label}
        <ArrowRight aria-hidden />
      </SubmitButton>
    </form>
  );
}

/** Signing for goods the supplier delivered or the customer collected. */
export function RecordDeliveryDialog({
  deliveryId,
  isCollection,
  contactName,
}: {
  deliveryId: string;
  isCollection: boolean;
  contactName: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState<DeliveryActionState, FormData>(
    completeDeliveryAction,
    null,
  );

  React.useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button block>
          <CheckCircle2 aria-hidden />
          {isCollection ? "Record the collection" : "Record the delivery"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isCollection ? "Goods collected" : "Goods delivered"}</DialogTitle>
          <DialogDescription>
            Record who took the materials. This is the detail that settles a later disagreement
            about whether an order arrived, so use the name of the person actually there.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="deliveryId" value={deliveryId} />
          <FormMessage state={state} />

          <Field
            name="receivedBy"
            label="Who received the goods?"
            required
            error={fieldError(state, "receivedBy")}
          >
            {(control) => <Input {...control} defaultValue={contactName} />}
          </Field>

          <Field
            name="proof"
            label="Photograph (optional)"
            hint="A photo of the goods at the site, or of the signed delivery note."
            error={fieldError(state, "proof")}
          >
            {(control) => (
              <Input
                {...control}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="h-auto py-2 file:mr-3 file:rounded file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-800"
              />
            )}
          </Field>

          <Field name="note" label="Anything worth recording?" error={fieldError(state, "note")}>
            {(control) => (
              <Textarea {...control} rows={2} placeholder="Two bags swapped for undamaged ones." />
            )}
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Recording…">
              {isCollection ? "Mark collected" : "Mark delivered"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type TransporterOption = {
  id: string;
  businessName: string;
  type: keyof typeof DELIVERY_PROVIDER_TYPE_LABELS;
  phone: string;
  quotedFeeMinor: number | null;
  completedDeliveries: number;
  isDemo: boolean;
  vehicles: Array<{ id: string; type: keyof typeof VEHICLE_TYPE_LABELS; registration: string }>;
};

/**
 * Handing a third-party delivery to a specific transporter.
 *
 * A supplier who already works with a driver should not have to wait for
 * somebody to claim the job off the board, so assignment exists alongside the
 * board rather than instead of it.
 */
export function AssignTransporterDialog({
  deliveryId,
  transporters,
  currentFeeMinor,
}: {
  deliveryId: string;
  transporters: TransporterOption[];
  currentFeeMinor: number;
}) {
  const [open, setOpen] = React.useState(false);
  const [providerId, setProviderId] = React.useState(transporters[0]?.id ?? "");
  const [state, formAction] = useActionState<DeliveryActionState, FormData>(
    assignDeliveryAction,
    null,
  );

  React.useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  const selected = transporters.find((transporter) => transporter.id === providerId);
  const suggestedFeeMinor = selected?.quotedFeeMinor ?? currentFeeMinor;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button block variant="secondary">
          <Truck aria-hidden />
          Assign a transporter
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign a transporter</DialogTitle>
          <DialogDescription>
            Only transporters who cover this destination and are accepting work are listed. The
            transporter is paid by the customer for the transport, not by BuildLink.
          </DialogDescription>
        </DialogHeader>

        {transporters.length === 0 ? (
          <Alert tone="info" title="No transporter covers this destination yet">
            Leave the job on the board — a transporter serving this area can still claim it — or
            deliver it yourself and change the fulfilment method with the customer.
          </Alert>
        ) : (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="deliveryId" value={deliveryId} />
            <FormMessage state={state} />

            <Field
              name="providerId"
              label="Transporter"
              required
              error={fieldError(state, "providerId")}
            >
              {(control) => (
                <NativeSelect
                  {...control}
                  value={providerId}
                  onChange={(event) => setProviderId(event.target.value)}
                >
                  {transporters.map((transporter) => (
                    <option key={transporter.id} value={transporter.id}>
                      {transporter.businessName}
                      {transporter.quotedFeeMinor === null
                        ? ""
                        : ` — ${formatZmw(transporter.quotedFeeMinor)}`}
                      {transporter.isDemo ? " (demo)" : ""}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>

            {selected ? (
              <p className="text-xs text-foreground-muted">
                {DELIVERY_PROVIDER_TYPE_LABELS[selected.type]} · {selected.phone} ·{" "}
                {selected.completedDeliveries} completed deliver
                {selected.completedDeliveries === 1 ? "y" : "ies"}
              </p>
            ) : null}

            {selected && selected.vehicles.length > 0 ? (
              <Field name="vehicleId" label="Vehicle" error={fieldError(state, "vehicleId")}>
                {(control) => (
                  <NativeSelect {...control} defaultValue="" key={selected.id}>
                    <option value="">Let the transporter choose</option>
                    {selected.vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {VEHICLE_TYPE_LABELS[vehicle.type]} · {vehicle.registration}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
            ) : null}

            <Field
              name="feeMinor"
              label="Transport charge (ZMW)"
              hint="What the customer pays the transporter. Prefilled from the rate they publish for this area."
              error={fieldError(state, "feeMinor")}
            >
              {(control) => (
                <Input
                  {...control}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  defaultValue={toKwacha(suggestedFeeMinor)}
                  key={`${selected?.id ?? "none"}-${suggestedFeeMinor}`}
                />
              )}
            </Field>

            <Field
              name="scheduledFor"
              label="When should they collect?"
              error={fieldError(state, "scheduledFor")}
            >
              {(control) => <Input {...control} type="datetime-local" />}
            </Field>

            <Field name="note" label="Note for the transporter" error={fieldError(state, "note")}>
              {(control) => (
                <Textarea
                  {...control}
                  rows={2}
                  placeholder="Load from the Kafue Road yard, ask for Mwansa at the gate."
                />
              )}
            </Field>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton pendingText="Assigning…">Assign the job</SubmitButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function SupplierCancelOrderDialog({
  orderId,
  orderNumber,
}: {
  orderId: string;
  orderNumber: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState<OrderActionState, FormData>(cancelOrderAction, null);

  React.useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Ban aria-hidden />
          Cancel order
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel order {orderNumber}?</DialogTitle>
          <DialogDescription>
            The customer is told why, and the stock goes back into your catalogue. Cancellations
            count against your trust score, so use this when you genuinely cannot supply — not to
            tidy up your order list.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="orderId" value={orderId} />
          <FormMessage state={state} />

          <Field
            name="reason"
            label="Why can you not supply this order?"
            required
            error={fieldError(state, "reason")}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={3}
                placeholder="The plant has not delivered our cement and I cannot say when it will."
              />
            )}
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Keep the order
            </Button>
            <SubmitButton variant="danger" pendingText="Cancelling…">
              Cancel order
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A delivery attempt that did not work: nobody on site, road impassable. */
export function FailDeliveryDialog({ deliveryId }: { deliveryId: string }) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState<DeliveryActionState, FormData>(
    failDeliveryAction,
    null,
  );

  React.useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <PackageX aria-hidden />
          Delivery did not work
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a failed delivery</DialogTitle>
          <DialogDescription>
            The order stays open so you can try again. The customer is told what happened.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="deliveryId" value={deliveryId} />
          <FormMessage state={state} />

          <Field
            name="reason"
            label="What went wrong?"
            required
            error={fieldError(state, "reason")}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={3}
                placeholder="Nobody was on site and the gate was locked."
              />
            )}
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Back
            </Button>
            <SubmitButton variant="danger" pendingText="Saving…">
              Record it
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
