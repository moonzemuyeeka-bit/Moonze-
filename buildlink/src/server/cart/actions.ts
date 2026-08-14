"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { ANALYTICS_EVENTS, track } from "@/lib/services/analytics";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  actionFailure,
  actionSuccess,
  NotFoundError,
  toActionError,
  type ActionResult,
} from "@/lib/errors";
import { fieldErrorsFrom, formDataToObject } from "@/lib/validation/shared";
import {
  addToCartSchema,
  removeCartItemSchema,
  setCartProjectSchema,
  updateCartItemSchema,
} from "@/lib/validation/marketplace";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Cart mutations.
 *
 * The cart is server-side state, not browser state: a customer comparing prices
 * on a phone and finishing on a laptop keeps the same basket, and stock and
 * price checks happen where they can be trusted. Every action re-reads the
 * product, because "add to cart" is a claim about something that may have sold
 * out since the page rendered.
 */

export type CartActionState = ActionResult<{ itemCount: number }> | null;

async function activeCart(user: SessionUser): Promise<{ id: string }> {
  const existing = await db.cart.findFirst({
    where: { userId: user.id, checkedOutAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (existing) return existing;

  return db.cart.create({ data: { userId: user.id }, select: { id: true } });
}

async function countItems(cartId: string): Promise<number> {
  return db.cartItem.count({ where: { cartId } });
}

export async function addToCartAction(
  _previous: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  try {
    const user = await requirePermission("cart:use");
    await enforceRateLimit("mutation", user.id);

    const parsed = addToCartSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check the quantity.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }

    const product = await db.product.findFirst({
      where: {
        id: parsed.data.productId,
        status: "ACTIVE",
        deletedAt: null,
        supplier: { deletedAt: null, isSuspended: false },
      },
      select: {
        id: true,
        name: true,
        minimumOrderQuantity: true,
        stockQuantity: true,
        priceMinor: true,
        supplierId: true,
      },
    });
    if (!product) {
      return actionFailure("That product is no longer available.", "NOT_FOUND");
    }

    if (parsed.data.quantity < product.minimumOrderQuantity) {
      return actionFailure(
        `This supplier sells this in minimum quantities of ${product.minimumOrderQuantity}.`,
        "VALIDATION_ERROR",
        { quantity: [`Order at least ${product.minimumOrderQuantity}.`] },
      );
    }

    if (product.stockQuantity <= 0) {
      return actionFailure("That product is out of stock.", "VALIDATION_ERROR", {
        quantity: ["Out of stock."],
      });
    }

    const cart = await activeCart(user);

    // Adding the same product twice tops up the existing line rather than
    // creating a duplicate the customer would have to reconcile by hand.
    const existing = await db.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId: product.id } },
      select: { id: true, quantity: true },
    });

    const quantity = Math.min(
      (existing?.quantity ?? 0) + parsed.data.quantity,
      Math.max(product.stockQuantity, product.minimumOrderQuantity),
    );

    if (existing) {
      await db.cartItem.update({ where: { id: existing.id }, data: { quantity } });
    } else {
      await db.cartItem.create({
        data: { cartId: cart.id, productId: product.id, quantity },
      });
    }

    if (parsed.data.projectId) {
      const project = await db.project.findFirst({
        where: { id: parsed.data.projectId, customerId: user.id, deletedAt: null },
        select: { id: true },
      });
      if (project) {
        await db.cart.update({ where: { id: cart.id }, data: { projectId: project.id } });
      }
    }

    await track({
      name: ANALYTICS_EVENTS.productAddedToCart,
      userId: user.id,
      properties: { productId: product.id, supplierId: product.supplierId, quantity },
    });

    revalidatePath("/cart");
    revalidatePath("/marketplace", "layout");
    return actionSuccess({ itemCount: await countItems(cart.id) });
  } catch (error) {
    return toActionError(error, "addToCartAction");
  }
}

export async function updateCartItemAction(
  _previous: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  try {
    const user = await requirePermission("cart:use");
    await enforceRateLimit("mutation", user.id);

    const parsed = updateCartItemSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check the quantity.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }

    const item = await db.cartItem.findFirst({
      where: { id: parsed.data.itemId, cart: { userId: user.id, checkedOutAt: null } },
      select: { id: true, cartId: true, product: { select: { stockQuantity: true } } },
    });
    if (!item) throw new NotFoundError("cart item");

    if (parsed.data.quantity > item.product.stockQuantity) {
      return actionFailure(
        item.product.stockQuantity > 0
          ? `Only ${item.product.stockQuantity} in stock.`
          : "That product is now out of stock.",
        "VALIDATION_ERROR",
        { quantity: [`Up to ${item.product.stockQuantity} available.`] },
      );
    }

    await db.cartItem.update({
      where: { id: item.id },
      data: { quantity: parsed.data.quantity },
    });

    revalidatePath("/cart");
    return actionSuccess({ itemCount: await countItems(item.cartId) });
  } catch (error) {
    return toActionError(error, "updateCartItemAction");
  }
}

export async function removeCartItemAction(
  _previous: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  try {
    const user = await requirePermission("cart:use");
    const parsed = removeCartItemSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return actionFailure("That item could not be removed.", "VALIDATION_ERROR");

    const item = await db.cartItem.findFirst({
      where: { id: parsed.data.itemId, cart: { userId: user.id, checkedOutAt: null } },
      select: { id: true, cartId: true },
    });
    if (!item) throw new NotFoundError("cart item");

    await db.cartItem.delete({ where: { id: item.id } });

    revalidatePath("/cart");
    return actionSuccess({ itemCount: await countItems(item.cartId) });
  } catch (error) {
    return toActionError(error, "removeCartItemAction");
  }
}

export async function clearCartAction(): Promise<ActionResult<undefined>> {
  try {
    const user = await requirePermission("cart:use");
    const cart = await db.cart.findFirst({
      where: { userId: user.id, checkedOutAt: null },
      select: { id: true },
    });
    if (cart) await db.cartItem.deleteMany({ where: { cartId: cart.id } });

    revalidatePath("/cart");
    return actionSuccess();
  } catch (error) {
    return toActionError(error, "clearCartAction");
  }
}

/** Attaches the cart to a project so its cost lands in the right budget. */
export async function setCartProjectAction(
  _previous: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  try {
    const user = await requirePermission("cart:use");
    const parsed = setCartProjectSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Choose a project from the list.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }

    if (parsed.data.projectId) {
      const project = await db.project.findFirst({
        where: { id: parsed.data.projectId, customerId: user.id, deletedAt: null },
        select: { id: true },
      });
      if (!project) {
        return actionFailure("That project could not be found.", "NOT_FOUND");
      }
    }

    const cart = await activeCart(user);
    await db.cart.update({
      where: { id: cart.id },
      data: { projectId: parsed.data.projectId },
    });

    revalidatePath("/cart");
    return actionSuccess();
  } catch (error) {
    return toActionError(error, "setCartProjectAction");
  }
}
