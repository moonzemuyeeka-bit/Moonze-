"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { FormMessage, fieldError } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { formatZmw } from "@/lib/money";
import { PRODUCT_UNIT_LABELS, PRODUCT_UNIT_SHORT } from "@/lib/labels";
import { addToCartAction } from "@/server/cart/actions";
import type { ProductUnit } from "@prisma/client";

/**
 * Quantity picker and add-to-cart.
 *
 * The running line total is shown as the quantity changes: buying 300 blocks is
 * a decision about money, not about a number of units, and it should not require
 * mental arithmetic on a phone.
 */
export function AddToCartForm({
  productId,
  unit,
  unitPriceMinor,
  minimumOrderQuantity,
  stockQuantity,
  projects,
  currentProjectId,
  quantityInCart,
  canBuy,
}: {
  productId: string;
  unit: ProductUnit;
  unitPriceMinor: number;
  minimumOrderQuantity: number;
  stockQuantity: number;
  projects: Array<{ id: string; name: string }>;
  currentProjectId: string | null;
  quantityInCart: number;
  canBuy: boolean;
}) {
  const [state, formAction] = useActionState(addToCartAction, null);
  const [quantity, setQuantity] = React.useState(Math.max(1, minimumOrderQuantity));

  const parsed = Number.isFinite(quantity) ? quantity : 0;
  const lineTotalMinor = unitPriceMinor * Math.max(0, parsed);
  const outOfStock = stockQuantity <= 0;

  if (!canBuy) {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-surface-muted p-4">
        <p className="text-sm text-foreground-muted">
          Sign in as a customer to add materials to your cart and place orders.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/login?returnTo=/marketplace/products/${productId}`}>Sign in</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/register">Create an account</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="productId" value={productId} />

      {outOfStock ? (
        <Alert tone="warning" title="Out of stock">
          This supplier has none left. Try another supplier for the same item, or check back later.
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <Field
          name="quantity"
          label={`Quantity (${PRODUCT_UNIT_LABELS[unit].toLowerCase()})`}
          required
          error={fieldError(state, "quantity")}
          hint={
            minimumOrderQuantity > 1
              ? `Minimum order ${minimumOrderQuantity} ${PRODUCT_UNIT_SHORT[unit]}`
              : `${stockQuantity} in stock`
          }
          className="w-40"
        >
          {(control) => (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Decrease quantity"
                disabled={parsed <= minimumOrderQuantity}
                onClick={() => setQuantity((value) => Math.max(minimumOrderQuantity, value - 1))}
              >
                <Minus />
              </Button>
              <Input
                {...control}
                type="number"
                min={minimumOrderQuantity}
                max={Math.max(stockQuantity, minimumOrderQuantity)}
                value={Number.isFinite(quantity) ? quantity : ""}
                onChange={(event) => setQuantity(Number.parseInt(event.target.value, 10))}
                className="text-center"
              />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Increase quantity"
                disabled={parsed >= stockQuantity}
                onClick={() => setQuantity((value) => Math.min(stockQuantity, value + 1))}
              >
                <Plus />
              </Button>
            </div>
          )}
        </Field>

        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-foreground-subtle">Line total</p>
          <p className="tabular text-xl font-semibold">{formatZmw(lineTotalMinor)}</p>
        </div>
      </div>

      {projects.length > 0 ? (
        <Field
          name="projectId"
          label="Add to project"
          hint="The cost is recorded against this project's budget."
          error={fieldError(state, "projectId")}
        >
          {(control) => (
            <NativeSelect {...control} defaultValue={currentProjectId ?? projects[0]?.id ?? ""}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
              <option value="">Not linked to a project</option>
            </NativeSelect>
          )}
        </Field>
      ) : null}

      <FormMessage state={state} successMessage="Added to your cart." />

      {quantityInCart > 0 ? (
        <p className="text-xs text-foreground-muted">
          {quantityInCart} already in your{" "}
          <Link href="/cart" className="font-medium text-brand-700 underline">
            cart
          </Link>
          .
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <SubmitButton size="lg" disabled={outOfStock}>
          <ShoppingCart />
          Add to cart
        </SubmitButton>
        {state?.ok ? (
          <Button asChild size="lg" variant="outline">
            <Link href="/cart">Go to cart</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
