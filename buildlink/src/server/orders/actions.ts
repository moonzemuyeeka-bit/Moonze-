"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission, requireUser } from "@/lib/auth/guards";
import { isAdminRole } from "@/lib/auth/permissions";
import { getCart } from "@/server/cart/queries";
import { commissionRateBpsFor } from "@/server/reference/queries";
import {
  applyOrderStatus,
  budgetKeysForProducts,
  createOrderAgreement,
  loadOrderForActor,
  newOrderNumber,
  recordProjectCommitment,
} from "@/server/orders/service";
import { mirrorDeliveryForOrderStatus } from "@/server/delivery/service";
import { buildOrderDrafts } from "@/lib/domain/cart";
import { actorCanTransitionOrder, assertOrderTransition } from "@/lib/domain/order-status";
import { ANALYTICS_EVENTS, track } from "@/lib/services/analytics";
import { notify } from "@/lib/services/notifications";
import { enforceRateLimit } from "@/lib/rate-limit";
import { formatZmw } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/lib/labels";
import {
  actionFailure,
  actionSuccess,
  AuthorisationError,
  ConflictError,
  toActionError,
  ValidationError,
  type ActionResult,
} from "@/lib/errors";
import { fieldErrorsFrom, formDataList, formDataToObject } from "@/lib/validation/shared";
import {
  cancelOrderSchema,
  checkoutSchema,
  completeOrderSchema,
  orderStatusUpdateSchema,
} from "@/lib/validation/checkout";

/**
 * Order lifecycle mutations.
 *
 * Checkout is where a shopping session becomes a set of commitments, so it is
 * the most defensive code in the product:
 *
 *  * Every figure is recomputed on the server from the cart and the supplier's
 *    own settings. The form sends choices, never prices.
 *  * One order per supplier, because each has its own minimum order, delivery
 *    arrangement, agreement and payment.
 *  * It is one transaction: the orders, the stock movements, the delivery
 *    records, the generated agreements, the project's budget entries and the
 *    wallet allocations either all exist or none do.
 *  * Stock is re-checked inside that transaction, not trusted from a cart page
 *    that rendered minutes ago.
 */

export type CheckoutActionState = ActionResult<{ orderIds: string[] }> | null;

export async function placeOrderAction(
  _previous: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState> {
  let destination: string;

  try {
    const user = await requirePermission("order:place");
    await enforceRateLimit("mutation", user.id);

    const parsed = checkoutSchema.safeParse({
      ...formDataToObject(formData),
      fulfilment: formDataList(formData, "fulfilment"),
    });
    if (!parsed.success) {
      return actionFailure(
        "Please check the highlighted fields.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }
    const input = parsed.data;

    const cart = await getCart(user.id, input.fulfilment);
    const cartId = cart.cartId;
    if (cartId === null || cart.summary.lineCount === 0) {
      throw new ValidationError("Your cart is empty.", {
        form: ["Add some materials to your cart before checking out."],
      });
    }
    if (!cart.summary.isCheckoutable) {
      throw new ValidationError("Some items need attention before you can order.", {
        form: ["Go back to your cart and resolve the highlighted problems."],
      });
    }

    const needsDelivery = cart.summary.groups.some(
      (group) => group.fulfilmentMethod !== "CUSTOMER_PICKUP",
    );
    if (needsDelivery && (!input.addressLine || !input.provinceId)) {
      throw new ValidationError("We need a delivery address.", {
        ...(input.addressLine
          ? {}
          : { addressLine: ["Enter where the materials should be delivered."] }),
        ...(input.provinceId ? {} : { provinceId: ["Choose a province."] }),
      });
    }

    if (input.provinceId) {
      const province = await db.province.findUnique({
        where: { id: input.provinceId },
        select: { id: true },
      });
      if (!province) {
        throw new ValidationError("Choose a province.", { provinceId: ["Select a province."] });
      }
    }

    // A project may only be attached by the customer who owns it.
    if (input.projectId) {
      const project = await db.project.findFirst({
        where: { id: input.projectId, customerId: user.id, deletedAt: null },
        select: { id: true },
      });
      if (!project) {
        throw new ValidationError("Choose one of your own projects.", {
          projectId: ["That project is not available."],
        });
      }
    }

    // Commission is resolved per supplier before the transaction so the rate is
    // snapshotted onto the order and a later change never rewrites history.
    const suppliers = await db.supplierProfile.findMany({
      where: { id: { in: cart.summary.groups.map((group) => group.supplier.id) } },
      select: { id: true, commissionRateBps: true, provinceId: true, userId: true, businessName: true },
    });
    const commissionRates = new Map<string, number>();
    for (const supplier of suppliers) {
      commissionRates.set(supplier.id, await commissionRateBpsFor(supplier.commissionRateBps));
    }
    const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));

    const drafts = buildOrderDrafts(cart.summary, {
      commissionRateBpsFor: (supplierId) => commissionRates.get(supplierId) ?? 0,
    });

    const budgetKeyByProduct = await budgetKeysForProducts(
      drafts.flatMap((draft) => draft.items.map((item) => item.productId)),
    );

    const orderIds = await db.$transaction(async (tx) => {
      const created: string[] = [];

      for (const draft of drafts) {
        const supplier = supplierById.get(draft.supplierId);
        if (!supplier) throw new ConflictError("One of these suppliers is no longer available.");

        // Re-check stock here: the cart page may be minutes old, and two
        // customers can reach checkout for the last ten bags at the same moment.
        for (const item of draft.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { name: true, stockQuantity: true, status: true, deletedAt: true },
          });
          if (!product || product.deletedAt !== null || product.status !== "ACTIVE") {
            throw new ConflictError(
              `"${item.productName}" is no longer available. Remove it from your cart and try again.`,
            );
          }
          if (product.stockQuantity < item.quantity) {
            throw new ConflictError(
              `Only ${product.stockQuantity} of "${product.name}" ${product.stockQuantity === 1 ? "is" : "are"} left. Adjust the quantity in your cart and try again.`,
            );
          }
        }

        const isPickup = draft.fulfilmentMethod === "CUSTOMER_PICKUP";
        const deliveryAddress = isPickup
          ? `Collection from ${supplier.businessName}`
          : (input.addressLine ?? "");

        const order = await tx.order.create({
          data: {
            orderNumber: newOrderNumber(),
            customerId: user.id,
            supplierId: draft.supplierId,
            projectId: input.projectId ?? null,
            status: "PENDING_PAYMENT",
            subtotalMinor: draft.subtotalMinor,
            deliveryFeeMinor: draft.deliveryFeeMinor,
            totalMinor: draft.totalMinor,
            commissionRateBps: draft.commissionRateBps,
            commissionMinor: draft.commissionMinor,
            fulfilmentMethod: draft.fulfilmentMethod,
            customerNote: input.customerNote ?? null,
            placedAt: new Date(),
            items: { create: draft.items },
            events: {
              create: {
                toStatus: "PENDING_PAYMENT",
                note: "Order placed.",
                actorUserId: user.id,
                actorRole: user.role,
              },
            },
          },
          select: { id: true, orderNumber: true },
        });

        created.push(order.id);

        for (const item of draft.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQuantity: { decrement: item.quantity },
              purchaseCount: { increment: 1 },
            },
          });
          await tx.inventory.upsert({
            where: { productId: item.productId },
            update: { quantityReserved: { increment: item.quantity } },
            create: { productId: item.productId, quantityReserved: item.quantity },
          });
        }

        // The delivery record exists from the moment the order does, even for a
        // collection, so there is always one place that answers "where are my
        // materials, and who is bringing them?".
        await tx.delivery.create({
          data: {
            orderId: order.id,
            method: draft.fulfilmentMethod,
            status: "REQUESTED",
            addressLine: deliveryAddress,
            provinceId: input.provinceId ?? supplier.provinceId,
            districtId: isPickup ? null : (input.districtId ?? null),
            locationDetail: input.locationDetail ?? null,
            contactName: input.contactName,
            contactPhone: input.contactPhone,
            instructions: input.instructions ?? null,
            feeMinor: draft.deliveryFeeMinor,
            events: { create: { toStatus: "REQUESTED", actorUserId: user.id } },
          },
        });

        await createOrderAgreement(tx, {
          orderId: order.id,
          customerId: user.id,
          supplierId: draft.supplierId,
          projectId: input.projectId ?? null,
          subtotalMinor: draft.subtotalMinor,
          deliveryFeeMinor: draft.deliveryFeeMinor,
          totalMinor: draft.totalMinor,
          deliveryLocation: isPickup
            ? deliveryAddress
            : [input.addressLine, input.locationDetail].filter(Boolean).join(", "),
          items: draft.items,
        });

        if (input.projectId) {
          await recordProjectCommitment(tx, {
            projectId: input.projectId,
            orderId: order.id,
            orderNumber: order.orderNumber,
            supplierName: supplier.businessName,
            totalMinor: draft.totalMinor,
            userId: user.id,
            budgetKey: budgetKeyByProduct.get(draft.items[0]?.productId ?? "") ?? "MISCELLANEOUS",
          });
        }
      }

      // Checking the cart out rather than deleting it preserves what was bought
      // together, which the reorder flow will need.
      await tx.cart.update({
        where: { id: cartId },
        data: { checkedOutAt: new Date(), projectId: input.projectId ?? null },
      });

      return created;
    });

    // Notifications and analytics run after the commit: a failure here must not
    // undo orders that have already been placed.
    for (const orderId of orderIds) {
      const order = await db.order.findUniqueOrThrow({
        where: { id: orderId },
        select: {
          orderNumber: true,
          totalMinor: true,
          supplier: { select: { userId: true, businessName: true } },
        },
      });

      await notify({
        userId: order.supplier.userId,
        type: "ORDER_PLACED",
        title: `New order ${order.orderNumber}`,
        body: `${user.name} has placed an order worth ${formatZmw(order.totalMinor)}. Confirm it so they know you can supply.`,
        linkUrl: `/supplier/orders/${orderId}`,
      });
      await notify({
        userId: user.id,
        type: "ORDER_PLACED",
        title: `Order ${order.orderNumber} placed`,
        body: `Your order with ${order.supplier.businessName} is waiting for payment and supplier confirmation.`,
        linkUrl: `/orders/${orderId}`,
      });
    }

    await track({
      name: ANALYTICS_EVENTS.orderCreated,
      userId: user.id,
      properties: {
        orderCount: orderIds.length,
        supplierCount: cart.summary.supplierCount,
        totalMinor: cart.summary.totalMinor,
        hasProject: input.projectId !== null,
      },
    });

    revalidatePath("/cart");
    revalidatePath("/orders");
    if (input.projectId) revalidatePath(`/customer/projects/${input.projectId}`);

    destination =
      orderIds.length === 1 && orderIds[0] ? `/orders/${orderIds[0]}?placed=1` : "/orders?placed=1";
  } catch (error) {
    return toActionError(error, "placeOrderAction");
  }

  redirect(destination);
}

// ---------------------------------------------------------------------------
// Status changes
// ---------------------------------------------------------------------------

export type OrderActionState = ActionResult<{ status: OrderStatus }> | null;

/**
 * Moves an order to a new status.
 *
 * Both halves of authorisation are checked: the state machine decides whether
 * the move is legal for this kind of actor, and `loadOrderForActor` decides
 * whether this particular person is a party to this particular order.
 */
export async function updateOrderStatusAction(
  _previous: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  try {
    const user = await requireUser();
    await enforceRateLimit("mutation", user.id);

    const parsed = orderStatusUpdateSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "That status change is not valid.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }

    const order = await loadOrderForActor(parsed.data.orderId, user);

    if (!actorCanTransitionOrder(user.role, order.status, parsed.data.status)) {
      throw new AuthorisationError(
        `You cannot move this order from "${ORDER_STATUS_LABELS[order.status]}" to "${ORDER_STATUS_LABELS[parsed.data.status]}".`,
      );
    }
    assertOrderTransition(order.status, parsed.data.status);

    await applyOrderStatus({
      orderId: order.id,
      from: order.status,
      to: parsed.data.status,
      note: parsed.data.note ?? null,
      actor: user,
    });

    // A supplier fulfilling an order themselves works from the order screen, so
    // their own delivery record follows the order rather than lagging behind it.
    await mirrorDeliveryForOrderStatus({
      orderId: order.id,
      orderStatus: parsed.data.status,
      actor: user,
      note: parsed.data.note ?? null,
    });

    revalidateOrder(order.id);
    return actionSuccess({ status: parsed.data.status });
  } catch (error) {
    return toActionError(error, "updateOrderStatusAction");
  }
}

export async function cancelOrderAction(
  _previous: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  try {
    const user = await requireUser();
    await enforceRateLimit("mutation", user.id);

    const parsed = cancelOrderSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please give a reason for the cancellation.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }

    const order = await loadOrderForActor(parsed.data.orderId, user);

    if (!actorCanTransitionOrder(user.role, order.status, "CANCELLED")) {
      throw new AuthorisationError(
        "This order has gone too far to cancel here. Speak to the supplier, or raise a dispute if something has gone wrong.",
      );
    }
    assertOrderTransition(order.status, "CANCELLED");

    await applyOrderStatus({
      orderId: order.id,
      from: order.status,
      to: "CANCELLED",
      note: parsed.data.reason,
      actor: user,
      cancellationReason: parsed.data.reason,
    });

    revalidateOrder(order.id);
    return actionSuccess({ status: "CANCELLED" });
  } catch (error) {
    return toActionError(error, "cancelOrderAction");
  }
}

/** The customer's confirmation that the materials arrived and were right. */
export async function completeOrderAction(
  _previous: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  try {
    const user = await requirePermission("order:place");
    const parsed = completeOrderSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure("That order is not valid.", "VALIDATION_ERROR");
    }

    const order = await loadOrderForActor(parsed.data.orderId, user);
    if (order.customerId !== user.id && !isAdminRole(user.role)) {
      throw new AuthorisationError("Only the customer can confirm an order is complete.");
    }
    assertOrderTransition(order.status, "COMPLETED");

    await applyOrderStatus({
      orderId: order.id,
      from: order.status,
      to: "COMPLETED",
      note: "Customer confirmed the order is complete.",
      actor: user,
    });

    revalidateOrder(order.id);
    return actionSuccess({ status: "COMPLETED" });
  } catch (error) {
    return toActionError(error, "completeOrderAction");
  }
}

function revalidateOrder(orderId: string): void {
  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/supplier/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/supplier/orders");
}
