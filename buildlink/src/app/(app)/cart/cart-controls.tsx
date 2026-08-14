"use client";

import * as React from "react";
import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { Input, NativeSelect } from "@/components/ui/input";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import {
  removeCartItemAction,
  setCartProjectAction,
  updateCartItemAction,
} from "@/server/cart/actions";

/**
 * Cart line controls.
 *
 * Quantity is a form, not an optimistic client counter: stock is finite and the
 * only place that knows what is left is the server. The trade-off is a round trip
 * per change, which is the right one when the alternative is telling somebody
 * they can have 400 blocks that do not exist.
 */
export function QuantityForm({
  itemId,
  quantity,
  maxQuantity,
}: {
  itemId: string;
  quantity: number;
  maxQuantity: number;
}) {
  const [state, formAction] = useActionState(updateCartItemAction, null);
  const [value, setValue] = React.useState(String(quantity));
  const dirty = value !== String(quantity);

  return (
    <form action={formAction} className="flex items-start gap-2">
      <input type="hidden" name="itemId" value={itemId} />
      <div>
        <label htmlFor={`quantity-${itemId}`} className="sr-only">
          Quantity
        </label>
        <Input
          id={`quantity-${itemId}`}
          name="quantity"
          type="number"
          min={1}
          max={Math.max(maxQuantity, 1)}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="h-9 w-20 text-center"
          aria-invalid={state && !state.ok ? true : undefined}
        />
        {state && !state.ok ? (
          <p className="mt-1 max-w-40 text-xs text-danger-700">{state.error}</p>
        ) : null}
      </div>
      {dirty ? (
        <SubmitButton size="sm" variant="outline">
          Update
        </SubmitButton>
      ) : null}
    </form>
  );
}

export function RemoveItemForm({ itemId, productName }: { itemId: string; productName: string }) {
  const [, formAction] = useActionState(removeCartItemAction, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="itemId" value={itemId} />
      <SubmitButton
        size="icon-sm"
        variant="ghost"
        className="text-foreground-muted hover:text-danger-700"
        aria-label={`Remove ${productName} from cart`}
      >
        <Trash2 />
      </SubmitButton>
    </form>
  );
}

/** Links the whole cart to a project so its cost lands in the right budget. */
export function CartProjectForm({
  projects,
  currentProjectId,
}: {
  projects: Array<{ id: string; name: string }>;
  currentProjectId: string | null;
}) {
  const [state, formAction] = useActionState(setCartProjectAction, null);

  return (
    <form action={formAction} className="space-y-2">
      <label htmlFor="cart-project" className="text-sm font-medium">
        Charge this order to
      </label>
      <div className="flex gap-2">
        <NativeSelect
          id="cart-project"
          name="projectId"
          defaultValue={currentProjectId ?? ""}
          className="h-10"
        >
          <option value="">No project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </NativeSelect>
        <SubmitButton variant="outline">Save</SubmitButton>
      </div>
      <p className="text-xs text-foreground-muted">
        Order costs are recorded against the project budget you choose.
      </p>
      <FormMessage state={state} successMessage="Project updated." />
    </form>
  );
}

export function ClearCartButton({ action }: { action: () => Promise<void> }) {
  return (
    <form action={action}>
      <SubmitButton size="sm" variant="ghost" className="text-foreground-muted">
        Empty cart
      </SubmitButton>
    </form>
  );
}
