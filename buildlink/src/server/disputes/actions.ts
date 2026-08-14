"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { notify } from "@/lib/services/notifications";
import { enforceRateLimit } from "@/lib/rate-limit";
import { loadOrderForActor, applyOrderStatus } from "@/server/orders/service";
import { canTransitionOrder } from "@/lib/domain/order-status";
import { DISPUTE_REASON_LABELS } from "@/lib/labels";
import {
  actionFailure,
  actionSuccess,
  AuthorisationError,
  ConflictError,
  toActionError,
  type ActionResult,
} from "@/lib/errors";
import { fieldErrorsFrom, formDataToObject } from "@/lib/validation/shared";
import { raiseDisputeSchema } from "@/lib/validation/admin";

/**
 * Escalating an order to BuildLink.
 *
 * Raising a dispute is the customer's (or supplier's) last resort, so it is
 * deliberately cheap to do and impossible to do quietly: the order is marked
 * DISPUTED, the counterparty is told, and every administrator gets it in their
 * queue. The decision itself lives in the admin console.
 */

export type RaiseDisputeState = ActionResult<{ id: string }> | null;

export async function raiseDisputeAction(
  _previous: RaiseDisputeState,
  formData: FormData,
): Promise<RaiseDisputeState> {
  try {
    const user = await requirePermission("dispute:raise");
    await enforceRateLimit("mutation", user.id);

    const parsed = raiseDisputeSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check the highlighted fields.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }
    const { orderId, reason, description } = parsed.data;

    const order = await loadOrderForActor(orderId, user);
    const raisedByCustomer = order.customerId === user.id;
    const raisedBySupplier = order.supplierUserId === user.id;
    if (!raisedByCustomer && !raisedBySupplier) {
      throw new AuthorisationError(
        "Only the customer or the supplier on an order can raise a dispute on it.",
      );
    }

    const existing = await db.dispute.findUnique({
      where: { orderId: order.id },
      select: { id: true, status: true },
    });
    if (existing) {
      throw new ConflictError(
        "A dispute has already been raised on this order. BuildLink will come back to you on the existing one.",
      );
    }

    // The order state machine decides when a dispute is the right instrument.
    // Before a supplier has confirmed, cancelling is both faster and fairer.
    if (!canTransitionOrder(order.status, "DISPUTED")) {
      throw new ConflictError(
        "This order cannot be disputed from where it is. If the supplier has not confirmed it yet, cancel it instead.",
      );
    }

    const dispute = await db.$transaction(async (tx) => {
      const created = await tx.dispute.create({
        data: {
          orderId: order.id,
          raisedById: user.id,
          supplierId: order.supplierId,
          reason,
          description,
          status: "OPEN",
        },
        select: { id: true },
      });

      await recordAudit(
        {
          action: AUDIT_ACTIONS.disputeOpened,
          resourceType: "dispute",
          resourceId: created.id,
          actorUserId: user.id,
          actorRole: user.role,
          newValue: { orderId: order.id, reason, orderStatus: order.status },
        },
        tx,
      );

      return created;
    });

    // The dispute record exists first: an order marked DISPUTED with nothing
    // explaining why would be worse than a moment's inconsistency the other way.
    await applyOrderStatus({
      orderId: order.id,
      from: order.status,
      to: "DISPUTED",
      note: `Dispute raised: ${DISPUTE_REASON_LABELS[reason]}.`,
      actor: user,
    });

    const admins = await db.user.findMany({
      where: { role: { in: [...ADMIN_ROLES] }, status: "ACTIVE", deletedAt: null },
      select: { id: true },
    });

    for (const admin of admins) {
      await notify({
        userId: admin.id,
        type: "DISPUTE_UPDATE",
        title: `Dispute raised on ${order.orderNumber}`,
        body: `${user.name} (${raisedByCustomer ? "customer" : "supplier"}): ${DISPUTE_REASON_LABELS[reason]}.`,
        linkUrl: `/admin/disputes/${dispute.id}`,
      });
    }

    await notify({
      userId: raisedByCustomer ? order.supplierUserId : order.customerId,
      type: "DISPUTE_UPDATE",
      title: `A dispute was raised on order ${order.orderNumber}`,
      body: `${DISPUTE_REASON_LABELS[reason]}. BuildLink will review it and contact both of you.`,
      linkUrl: raisedByCustomer ? `/supplier/orders/${order.id}` : `/orders/${order.id}`,
    });

    revalidatePath(`/orders/${order.id}`);
    revalidatePath(`/supplier/orders/${order.id}`);
    revalidatePath("/admin/disputes");
    revalidatePath("/admin/dashboard");
    return actionSuccess({ id: dispute.id });
  } catch (error) {
    return toActionError(error, "raiseDisputeAction");
  }
}
