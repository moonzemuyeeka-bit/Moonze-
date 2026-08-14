"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { loadOrderForActor } from "@/server/orders/service";
import { recalculateSupplierRating } from "@/server/reviews/service";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { notify } from "@/lib/services/notifications";
import { ANALYTICS_EVENTS, track } from "@/lib/services/analytics";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  actionFailure,
  AuthorisationError,
  ConflictError,
  toActionError,
  type ActionResult,
} from "@/lib/errors";
import { fieldErrorsFrom, formDataToObject } from "@/lib/validation/shared";
import { reviewSchema } from "@/lib/validation/marketplace";

/**
 * Reviews.
 *
 * Only the customer on a **completed** order can review, and only once — the
 * unique `orderId` on `Review` makes that a database guarantee rather than a
 * hope. Tying reviews to real completed transactions is the whole reason a
 * supplier's rating is worth anything to the next customer.
 */

export type ReviewActionState = ActionResult<{ reviewId: string }> | null;

export async function submitReviewAction(
  _previous: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  let destination: string;

  try {
    const user = await requirePermission("review:write");
    await enforceRateLimit("mutation", user.id);

    const parsed = reviewSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please choose a star rating.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }
    const input = parsed.data;

    const order = await loadOrderForActor(input.orderId, user);
    if (order.customerId !== user.id) {
      throw new AuthorisationError("Only the customer on this order can review it.");
    }
    if (order.status !== "COMPLETED") {
      throw new ConflictError(
        "You can review an order once it is complete — confirm you received everything first.",
      );
    }

    const existing = await db.review.findUnique({
      where: { orderId: order.id },
      select: { id: true, amendmentAllowed: true },
    });
    if (existing && !existing.amendmentAllowed) {
      throw new ConflictError(
        "You have already reviewed this order. Contact BuildLink support if it needs changing.",
      );
    }

    await db.$transaction(async (tx) => {
      const saved = await tx.review.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          customerId: user.id,
          supplierId: order.supplierId,
          rating: input.rating,
          productQualityRating: input.productQualityRating,
          priceRating: input.priceRating,
          deliveryRating: input.deliveryRating,
          communicationRating: input.communicationRating,
          reliabilityRating: input.reliabilityRating,
          comment: input.comment,
        },
        update: {
          rating: input.rating,
          productQualityRating: input.productQualityRating,
          priceRating: input.priceRating,
          deliveryRating: input.deliveryRating,
          communicationRating: input.communicationRating,
          reliabilityRating: input.reliabilityRating,
          comment: input.comment,
          amendmentAllowed: false,
        },
        select: { id: true },
      });

      await recalculateSupplierRating(order.supplierId, tx);

      await recordAudit(
        {
          action: AUDIT_ACTIONS.reviewSubmitted,
          resourceType: "review",
          resourceId: saved.id,
          actorUserId: user.id,
          actorRole: user.role,
          newValue: { orderId: order.id, rating: input.rating },
        },
        tx,
      );

      return saved;
    });

    await notify({
      userId: order.supplierUserId,
      type: "REVIEW_REMINDER",
      title: `New ${input.rating}-star review`,
      body: input.comment
        ? `${user.name} reviewed order ${order.orderNumber}: “${input.comment.slice(0, 160)}”`
        : `${user.name} rated order ${order.orderNumber} ${input.rating} out of 5.`,
      linkUrl: "/supplier/dashboard",
    });

    await track({
      name: ANALYTICS_EVENTS.reviewSubmitted,
      userId: user.id,
      properties: { rating: input.rating, hasComment: input.comment !== null },
    });

    revalidatePath(`/orders/${order.id}`);
    revalidatePath("/orders");
    revalidatePath("/customer/dashboard");
    destination = `/orders/${order.id}?reviewed=1`;
  } catch (error) {
    return toActionError(error, "submitReviewAction");
  }

  redirect(destination);
}
