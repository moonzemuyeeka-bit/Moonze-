"use client";

import * as React from "react";
import { useActionState } from "react";
import { Archive, Boxes, EyeOff, ImagePlus, Send, Trash2, Undo2 } from "lucide-react";
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
import { Input, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, fieldError } from "@/components/forms/form-message";
import {
  adjustStockAction,
  removeProductImageAction,
  setProductStatusAction,
  uploadProductImageAction,
  type ProductActionState,
} from "@/server/suppliers/actions";
import { PRODUCT_UNIT_LABELS } from "@/lib/labels";
import type { ProductStatus, ProductUnit } from "@prisma/client";

/**
 * Catalogue controls.
 *
 * All of these are one-purpose forms rather than an "edit everything" screen,
 * because that is how a supplier actually works: count the stock, hide the line
 * that has run out, add the photograph you just took.
 */

export function StockDialog({
  productId,
  productName,
  stockQuantity,
  unit,
}: {
  productId: string;
  productName: string;
  stockQuantity: number;
  unit: ProductUnit;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState<ProductActionState, FormData>(
    adjustStockAction,
    null,
  );

  React.useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Boxes aria-hidden />
          Update stock
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stock on hand</DialogTitle>
          <DialogDescription>
            {productName} — enter what you actually have, not the difference. Customers cannot order
            more than this figure.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="productId" value={productId} />
          <FormMessage state={state} />

          <Field
            name="quantityOnHand"
            label={`Quantity in ${PRODUCT_UNIT_LABELS[unit].toLowerCase()}s`}
            required
            error={fieldError(state, "quantityOnHand")}
          >
            {(control) => (
              <Input
                {...control}
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                defaultValue={stockQuantity}
                autoFocus
              />
            )}
          </Field>

          <Field
            name="reason"
            label="What changed?"
            hint="Recorded in your audit trail. Useful when the figures are queried later."
            error={fieldError(state, "reason")}
          >
            {(control) => (
              <Input {...control} placeholder="Delivery from the plant this morning" />
            )}
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Saving…">Save stock</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Publish, hide or retire a listing. */
export function ProductStatusForms({
  productId,
  status,
}: {
  productId: string;
  status: ProductStatus;
}) {
  const [state, formAction] = useActionState<ProductActionState, FormData>(
    setProductStatusAction,
    null,
  );

  const canOffer = status === "DRAFT" || status === "REJECTED" || status === "INACTIVE";
  const canHide = status === "ACTIVE";
  const canRestore = status === "ARCHIVED";

  return (
    <div className="space-y-2">
      <FormMessage state={state} />

      {canOffer ? (
        <form action={formAction}>
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="status" value="ACTIVE" />
          <SubmitButton block pendingText="Submitting…">
            <Send aria-hidden />
            {status === "INACTIVE" ? "Show this listing again" : "Send for approval"}
          </SubmitButton>
        </form>
      ) : null}

      {canHide ? (
        <form action={formAction}>
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="status" value="INACTIVE" />
          <SubmitButton block variant="outline" pendingText="Hiding…">
            <EyeOff aria-hidden />
            Hide from customers
          </SubmitButton>
        </form>
      ) : null}

      {canRestore ? (
        <form action={formAction}>
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="status" value="INACTIVE" />
          <SubmitButton block variant="outline" pendingText="Restoring…">
            <Undo2 aria-hidden />
            Restore this listing
          </SubmitButton>
        </form>
      ) : null}

      {status === "ARCHIVED" ? null : (
        <form action={formAction}>
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="status" value="ARCHIVED" />
          <SubmitButton block variant="ghost" size="sm" pendingText="Archiving…">
            <Archive aria-hidden />
            Archive
          </SubmitButton>
        </form>
      )}

      <p className="text-xs text-foreground-muted">
        Archiving keeps the listing and its order history but takes it out of your working
        catalogue. Nothing is ever deleted, because past orders refer to it.
      </p>
    </div>
  );
}

export function ProductImageUpload({ productId }: { productId: string }) {
  const [state, formAction] = useActionState<ProductActionState, FormData>(
    uploadProductImageAction,
    null,
  );
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="productId" value={productId} />
      <FormMessage state={state} successMessage="Photograph added." />

      <Field
        name="image"
        label="Add a photograph"
        hint="JPEG, PNG or WebP, up to 5 MB. A photo of the actual stock in your yard sells better than a catalogue image."
        error={fieldError(state, "image")}
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

      <Field name="altText" label="Describe the photograph" error={fieldError(state, "altText")}>
        {(control) => (
          <Textarea
            {...control}
            rows={2}
            placeholder="Pallets of cement bags stacked under cover at the yard."
          />
        )}
      </Field>

      <SubmitButton size="sm" pendingText="Uploading…">
        <ImagePlus aria-hidden />
        Upload
      </SubmitButton>
    </form>
  );
}

export function RemoveImageForm({ imageId }: { imageId: string }) {
  const [state, formAction] = useActionState<ProductActionState, FormData>(
    removeProductImageAction,
    null,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="imageId" value={imageId} />
      <FormMessage state={state} />
      <SubmitButton size="sm" variant="ghost" pendingText="Removing…">
        <Trash2 aria-hidden />
        <span className="sr-only sm:not-sr-only">Remove</span>
      </SubmitButton>
    </form>
  );
}
