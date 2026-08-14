"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { FileEdit, Save } from "lucide-react";
import { Field, FieldRow } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { CheckboxField } from "@/components/ui/controls";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, fieldError } from "@/components/forms/form-message";
import { saveProductAction, type ProductActionState } from "@/server/suppliers/actions";
import { PRODUCT_UNITS, PRODUCT_UNIT_LABELS } from "@/lib/labels";
import { toKwacha } from "@/lib/money";
import type { ProductStatus, ProductUnit } from "@prisma/client";

export type ProductFormCategory = {
  id: string;
  name: string;
  children: Array<{ id: string; name: string }>;
};

export type ProductFormValues = {
  id: string;
  name: string;
  brand: string | null;
  description: string | null;
  categoryId: string;
  unit: ProductUnit;
  priceMinor: number;
  minimumOrderQuantity: number;
  stockQuantity: number;
  lowStockThreshold: number;
  deliveryAvailable: boolean;
  status: ProductStatus;
};

/**
 * Listing editor, shared by "add a product" and "edit a product".
 *
 * Two submit buttons rather than a status dropdown: a supplier is either putting
 * something up for sale or saving work in progress, and asking them to reason
 * about `PENDING_APPROVAL` would be asking them to learn our vocabulary. The
 * price is typed in kwacha and converted to ngwee on the server.
 */
export function ProductForm({
  categories,
  product,
}: {
  categories: ProductFormCategory[];
  product?: ProductFormValues;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<ProductActionState, FormData>(
    saveProductAction,
    null,
  );

  const isNew = product === undefined;
  const createdId = state?.ok ? state.data.productId : null;

  React.useEffect(() => {
    // A new listing needs photographs next, and those live on its own page.
    if (isNew && createdId) router.push(`/supplier/products/${createdId}?created=1`);
  }, [createdId, isNew, router]);

  return (
    <form action={formAction} className="space-y-6">
      {product ? <input type="hidden" name="productId" value={product.id} /> : null}
      <FormMessage
        state={state}
        successMessage={isNew ? "Listing created." : "Your changes are saved."}
      />

      <div className="space-y-5">
        <Field
          name="name"
          label="Product name"
          required
          hint="What a customer would search for: 32.5 cement, river sand, IBR roofing sheet."
          error={fieldError(state, "name")}
        >
          {(control) => (
            <Input
              {...control}
              defaultValue={product?.name ?? ""}
              placeholder="Lafarge Mphamvu 32.5R cement"
              maxLength={160}
            />
          )}
        </Field>

        <FieldRow>
          <Field
            name="categoryId"
            label="Category"
            required
            hint="Customers filter by category, so the right one wins you views."
            error={fieldError(state, "categoryId")}
          >
            {(control) => (
              <NativeSelect {...control} defaultValue={product?.categoryId ?? ""}>
                <option value="">Choose a category</option>
                {categories.map((category) => (
                  <optgroup key={category.id} label={category.name}>
                    <option value={category.id}>{category.name} (general)</option>
                    {category.children.map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </NativeSelect>
            )}
          </Field>

          <Field
            name="brand"
            label="Brand or make"
            hint="Leave blank if it is unbranded, like sand or stone."
            error={fieldError(state, "brand")}
          >
            {(control) => (
              <Input {...control} defaultValue={product?.brand ?? ""} placeholder="Lafarge" />
            )}
          </Field>
        </FieldRow>

        <Field
          name="description"
          label="Description"
          hint="Grade, size, coverage, where it is stocked — the questions you get asked on the phone."
          error={fieldError(state, "description")}
        >
          {(control) => (
            <Textarea
              {...control}
              rows={4}
              defaultValue={product?.description ?? ""}
              placeholder="50kg bags of 32.5R general-purpose cement, kept under cover. Suitable for foundations, walling and plaster."
            />
          )}
        </Field>
      </div>

      <div className="space-y-5 rounded-xl border border-border bg-surface-muted/40 p-4">
        <h2 className="text-sm font-semibold text-foreground">Price and quantity</h2>

        <FieldRow>
          <Field
            name="priceMinor"
            label="Price per unit (ZMW)"
            required
            hint="What one unit costs today. Changing it sends the listing back for approval."
            error={fieldError(state, "priceMinor")}
          >
            {(control) => (
              <Input
                {...control}
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                defaultValue={product ? toKwacha(product.priceMinor) : ""}
                placeholder="185.00"
              />
            )}
          </Field>

          <Field name="unit" label="Sold by" required error={fieldError(state, "unit")}>
            {(control) => (
              <NativeSelect {...control} defaultValue={product?.unit ?? "BAG"}>
                {PRODUCT_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {PRODUCT_UNIT_LABELS[unit]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
        </FieldRow>

        <FieldRow>
          <Field
            name="minimumOrderQuantity"
            label="Minimum order"
            required
            hint="The smallest quantity you will supply."
            error={fieldError(state, "minimumOrderQuantity")}
          >
            {(control) => (
              <Input
                {...control}
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                defaultValue={product?.minimumOrderQuantity ?? 1}
              />
            )}
          </Field>

          <Field
            name="stockQuantity"
            label="Stock on hand"
            required
            hint="Customers cannot order more than this, so an honest figure prevents cancellations."
            error={fieldError(state, "stockQuantity")}
          >
            {(control) => (
              <Input
                {...control}
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                defaultValue={product?.stockQuantity ?? 0}
              />
            )}
          </Field>
        </FieldRow>

        <Field
          name="lowStockThreshold"
          label="Warn me when stock reaches"
          hint="BuildLink flags the listing on your dashboard at or below this level."
          error={fieldError(state, "lowStockThreshold")}
          className="sm:max-w-xs"
        >
          {(control) => (
            <Input
              {...control}
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              defaultValue={product?.lowStockThreshold ?? 10}
            />
          )}
        </Field>

        <CheckboxField
          id="deliveryAvailable"
          name="deliveryAvailable"
          label="I can deliver this product"
          description="Leave unchecked for goods a customer must collect, or that need a transporter."
          defaultChecked={product?.deliveryAvailable ?? true}
        />
      </div>

      {product && product.status === "ACTIVE" ? (
        <Alert tone="info" hideIcon>
          This listing is live. Editing the name, price, unit or category sends it back to BuildLink
          for approval — stock, photographs and the description update immediately.
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton name="intent" value="publish" pendingText="Saving…">
          <Save aria-hidden />
          {isNew ? "Save and put up for approval" : "Save changes"}
        </SubmitButton>
        {isNew || product?.status === "DRAFT" ? (
          <SubmitButton name="intent" value="draft" variant="outline" pendingText="Saving…">
            <FileEdit aria-hidden />
            Save as a draft
          </SubmitButton>
        ) : null}
      </div>

      <p className="text-xs text-foreground-muted">
        BuildLink reviews new and re-priced listings before customers see them. Reviews are usually
        quick; a draft is never shown to anybody.
      </p>
    </form>
  );
}
