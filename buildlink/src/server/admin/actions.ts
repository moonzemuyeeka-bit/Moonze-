"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { destroyAllSessionsForUser } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/permissions";
import { AUDIT_ACTIONS, auditSnapshot, recordAudit } from "@/lib/audit";
import { notify } from "@/lib/services/notifications";
import { enforceRateLimit } from "@/lib/rate-limit";
import { recalculateSupplierRating } from "@/server/reviews/service";
import {
  actionFailure,
  actionSuccess,
  AuthorisationError,
  ConflictError,
  NotFoundError,
  toActionError,
  type ActionResult,
} from "@/lib/errors";
import { fieldErrorsFrom, formDataToObject } from "@/lib/validation/shared";
import {
  disputeDecisionSchema,
  documentDecisionSchema,
  platformSettingsSchema,
  productModerationSchema,
  reviewModerationSchema,
  supplierCommercialsSchema,
  supplierSuspensionSchema,
  userRoleSchema,
  userStatusSchema,
  verificationDecisionSchema,
} from "@/lib/validation/admin";
import { PLATFORM_SETTING_HINTS, PLATFORM_SETTING_KEYS } from "@/lib/platform-settings";
import { SUPPLIER_DOCUMENT_TYPE_LABELS } from "@/lib/labels";

/**
 * Administration mutations.
 *
 * Three rules hold for everything in this file:
 *  * the actor is resolved by `requireAdmin` from the session, never from input;
 *  * every decision writes an `AuditLog` row with the before and after values,
 *    because an unexplained administrative action is indistinguishable from an
 *    abuse of access;
 *  * anything that removes something from a person notifies them and tells them
 *    why, in the same words the audit log records.
 */

export type AdminActionState = ActionResult<{ id: string }> | null;
export type SettingsActionState = ActionResult<{ updated: number }> | null;

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/**
 * Suspends, deactivates or reinstates an account.
 *
 * Suspension signs the account out everywhere: leaving a live session running
 * would make the suspension advisory rather than real.
 */
export async function setUserStatusAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const admin = await requireAdmin();
    await enforceRateLimit("mutation", admin.id);

    const parsed = userStatusSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check the highlighted fields.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }
    const { userId, status, reason } = parsed.data;

    const user = await db.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, name: true, role: true, status: true },
    });
    if (!user) throw new NotFoundError("user");

    if (user.id === admin.id) {
      throw new ConflictError("You cannot change the status of your own account.");
    }
    // Only a super administrator may act on another administrator.
    if (isAdminRole(user.role) && admin.role !== "SUPER_ADMIN") {
      throw new AuthorisationError("Only a super administrator can suspend an administrator.");
    }
    if (user.status === status) return actionSuccess({ id: user.id });

    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { status } });

      // A suspended supplier must stop trading, or a customer could still order
      // from a business BuildLink has just stopped.
      if (user.role === "SUPPLIER") {
        await tx.supplierProfile.updateMany({
          where: { userId: user.id },
          data:
            status === "ACTIVE"
              ? { isSuspended: false, suspendedReason: null }
              : { isSuspended: true, suspendedReason: reason ?? "Account suspended by BuildLink." },
        });
      }

      await recordAudit(
        {
          action: status === "ACTIVE" ? AUDIT_ACTIONS.userReinstated : AUDIT_ACTIONS.userSuspended,
          resourceType: "user",
          resourceId: user.id,
          actorUserId: admin.id,
          actorRole: admin.role,
          previousValue: { status: user.status },
          newValue: { status, reason: reason ?? null },
        },
        tx,
      );
    });

    if (status !== "ACTIVE") await destroyAllSessionsForUser(user.id);

    await notify({
      userId: user.id,
      type: "SUPPLIER_VERIFICATION_UPDATE",
      title: status === "ACTIVE" ? "Your account has been restored" : "Your account is suspended",
      body:
        status === "ACTIVE"
          ? "You can sign in and trade on BuildLink again."
          : `${reason ?? "BuildLink has suspended this account."} Contact BuildLink support if you believe this is wrong.`,
    });

    revalidateUsers(user.id);
    return actionSuccess({ id: user.id });
  } catch (error) {
    return toActionError(error, "setUserStatusAction");
  }
}

/** Changes what a person can do on BuildLink. Super administrators only. */
export async function setUserRoleAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const admin = await requireAdmin();
    await enforceRateLimit("mutation", admin.id);

    if (admin.role !== "SUPER_ADMIN") {
      throw new AuthorisationError("Only a super administrator can change a person's role.");
    }

    const parsed = userRoleSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check the highlighted fields.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }
    const { userId, role, reason } = parsed.data;

    const user = await db.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        role: true,
        supplierProfile: { select: { id: true } },
        deliveryProvider: { select: { id: true } },
      },
    });
    if (!user) throw new NotFoundError("user");
    if (user.id === admin.id) throw new ConflictError("You cannot change your own role.");
    if (user.role === role) return actionSuccess({ id: user.id });

    // A role without the profile it depends on would land the person on a
    // console with nothing in it, so the profile has to exist first.
    if (role === "SUPPLIER" && !user.supplierProfile) {
      throw new ConflictError(
        "This person has no supplier business. They need to register one before taking the supplier role.",
      );
    }
    if (role === "DELIVERY_PROVIDER" && !user.deliveryProvider) {
      throw new ConflictError(
        "This person has no transport business. They need to register one before taking the transporter role.",
      );
    }

    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { role } });
      await recordAudit(
        {
          action: AUDIT_ACTIONS.userRoleChanged,
          resourceType: "user",
          resourceId: user.id,
          actorUserId: admin.id,
          actorRole: admin.role,
          previousValue: { role: user.role },
          newValue: { role, reason },
        },
        tx,
      );
    });

    // The old role's permissions are cached in nothing, but a live session
    // showing the previous console would confuse; a fresh sign-in is cleanest.
    await destroyAllSessionsForUser(user.id);

    revalidateUsers(user.id);
    return actionSuccess({ id: user.id });
  } catch (error) {
    return toActionError(error, "setUserRoleAction");
  }
}

function revalidateUsers(userId: string): void {
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/dashboard");
}

// ---------------------------------------------------------------------------
// Supplier verification
// ---------------------------------------------------------------------------

/**
 * The verification decision.
 *
 * This is the most consequential thing an administrator does: a verified badge
 * is BuildLink telling a customer it has checked the business. Approving without
 * documents is therefore refused outright rather than left to judgement.
 */
export async function decideVerificationAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const admin = await requireAdmin();
    await enforceRateLimit("mutation", admin.id);

    const parsed = verificationDecisionSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check the highlighted fields.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }
    const { supplierId, decision, note } = parsed.data;

    const supplier = await db.supplierProfile.findFirst({
      where: { id: supplierId, deletedAt: null },
      select: {
        id: true,
        userId: true,
        businessName: true,
        slug: true,
        verificationStatus: true,
        businessRegistrationStatus: true,
        _count: { select: { documents: { where: { reviewStatus: "APPROVED" } } } },
      },
    });
    if (!supplier) throw new NotFoundError("supplier");

    if (decision === "VERIFIED" && supplier._count.documents === 0) {
      throw new ConflictError(
        "Accept at least one document before verifying this business. Verification means BuildLink has seen the paperwork.",
      );
    }

    await db.$transaction(async (tx) => {
      await tx.supplierProfile.update({
        where: { id: supplier.id },
        data: {
          verificationStatus: decision,
          verifiedAt: decision === "VERIFIED" ? new Date() : null,
          businessRegistrationStatus:
            decision === "VERIFIED" ? "VERIFIED" : supplier.businessRegistrationStatus,
        },
      });

      const open = await tx.supplierVerification.findFirst({
        where: { supplierId: supplier.id, status: "PENDING" },
        select: { id: true },
      });
      if (open) {
        await tx.supplierVerification.update({
          where: { id: open.id },
          data: {
            status: decision,
            reviewedById: admin.id,
            reviewedAt: new Date(),
            decisionNote: note ?? null,
          },
        });
      } else {
        await tx.supplierVerification.create({
          data: {
            supplierId: supplier.id,
            status: decision,
            reviewedById: admin.id,
            reviewedAt: new Date(),
            decisionNote: note ?? null,
          },
        });
      }

      await recordAudit(
        {
          action:
            decision === "VERIFIED"
              ? AUDIT_ACTIONS.supplierVerified
              : AUDIT_ACTIONS.supplierVerificationRejected,
          resourceType: "supplier",
          resourceId: supplier.id,
          actorUserId: admin.id,
          actorRole: admin.role,
          previousValue: { verificationStatus: supplier.verificationStatus },
          newValue: { verificationStatus: decision, note: note ?? null },
        },
        tx,
      );
    });

    await notify({
      userId: supplier.userId,
      type: "SUPPLIER_VERIFICATION_UPDATE",
      title:
        decision === "VERIFIED"
          ? "Your business is verified"
          : "BuildLink could not verify your business",
      body:
        decision === "VERIFIED"
          ? "Customers now see the verified badge on your profile and your listings rank higher in search."
          : `${note ?? "BuildLink could not confirm your documents."} Upload corrected documents and we will review them again.`,
      linkUrl: "/supplier/verification",
    });

    revalidateSupplier(supplier.id, supplier.slug);
    return actionSuccess({ id: supplier.id });
  } catch (error) {
    return toActionError(error, "decideVerificationAction");
  }
}

/** Accepts or rejects one document within a verification review. */
export async function decideDocumentAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const admin = await requireAdmin();
    await enforceRateLimit("mutation", admin.id);

    const parsed = documentDecisionSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check the highlighted fields.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }
    const { documentId, decision, note } = parsed.data;

    const document = await db.supplierDocument.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        type: true,
        reviewStatus: true,
        supplier: { select: { id: true, userId: true, slug: true } },
      },
    });
    if (!document) throw new NotFoundError("document");

    await db.$transaction(async (tx) => {
      await tx.supplierDocument.update({
        where: { id: document.id },
        data: {
          reviewStatus: decision,
          reviewNote: note ?? null,
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      });
      await recordAudit(
        {
          action: AUDIT_ACTIONS.supplierDocumentReviewed,
          resourceType: "supplier_document",
          resourceId: document.id,
          actorUserId: admin.id,
          actorRole: admin.role,
          previousValue: { reviewStatus: document.reviewStatus },
          newValue: { reviewStatus: decision, note: note ?? null },
        },
        tx,
      );
    });

    if (decision === "REJECTED") {
      await notify({
        userId: document.supplier.userId,
        type: "SUPPLIER_VERIFICATION_UPDATE",
        title: "A document needs replacing",
        body: `${SUPPLIER_DOCUMENT_TYPE_LABELS[document.type]}: ${note ?? "could not be accepted."}`,
        linkUrl: "/supplier/verification",
      });
    }

    revalidateSupplier(document.supplier.id, document.supplier.slug);
    return actionSuccess({ id: document.id });
  } catch (error) {
    return toActionError(error, "decideDocumentAction");
  }
}

/** Stops or restarts a business's ability to trade, without touching its login. */
export async function setSupplierSuspensionAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const admin = await requireAdmin();
    await enforceRateLimit("mutation", admin.id);

    const parsed = supplierSuspensionSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check the highlighted fields.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }
    const { supplierId, reason } = parsed.data;
    const suspend = parsed.data.suspend === "true";

    const supplier = await db.supplierProfile.findFirst({
      where: { id: supplierId, deletedAt: null },
      select: { id: true, userId: true, slug: true, isSuspended: true, businessName: true },
    });
    if (!supplier) throw new NotFoundError("supplier");
    if (supplier.isSuspended === suspend) return actionSuccess({ id: supplier.id });

    await db.$transaction(async (tx) => {
      await tx.supplierProfile.update({
        where: { id: supplier.id },
        data: {
          isSuspended: suspend,
          suspendedReason: suspend ? (reason ?? null) : null,
          // Suspension has to take the catalogue out of search, or customers
          // keep ordering from a business that cannot supply them.
          verificationStatus: suspend ? "SUSPENDED" : "PENDING",
        },
      });
      await recordAudit(
        {
          action: suspend ? AUDIT_ACTIONS.supplierSuspended : AUDIT_ACTIONS.supplierReinstated,
          resourceType: "supplier",
          resourceId: supplier.id,
          actorUserId: admin.id,
          actorRole: admin.role,
          previousValue: { isSuspended: supplier.isSuspended },
          newValue: { isSuspended: suspend, reason: reason ?? null },
        },
        tx,
      );
    });

    await notify({
      userId: supplier.userId,
      type: "SUPPLIER_VERIFICATION_UPDATE",
      title: suspend ? "Trading is suspended" : "Trading is restored",
      body: suspend
        ? `${reason ?? "BuildLink has suspended trading on this business."} Your listings are hidden while this is reviewed.`
        : "Your listings can be shown to customers again. Your verification is back in the review queue.",
      linkUrl: "/supplier/dashboard",
    });

    revalidateSupplier(supplier.id, supplier.slug);
    return actionSuccess({ id: supplier.id });
  } catch (error) {
    return toActionError(error, "setSupplierSuspensionAction");
  }
}

/** Subscription tier, commission override and demo flag. */
export async function setSupplierCommercialsAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const admin = await requireAdmin();
    await enforceRateLimit("mutation", admin.id);

    const parsed = supplierCommercialsSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check the highlighted fields.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }
    const { supplierId, subscriptionTier, commissionRateBps } = parsed.data;

    const supplier = await db.supplierProfile.findFirst({
      where: { id: supplierId, deletedAt: null },
      select: { id: true, slug: true, subscriptionTier: true, commissionRateBps: true },
    });
    if (!supplier) throw new NotFoundError("supplier");

    await db.$transaction(async (tx) => {
      await tx.supplierProfile.update({
        where: { id: supplier.id },
        data: { subscriptionTier, commissionRateBps },
      });
      await recordAudit(
        {
          action: AUDIT_ACTIONS.platformSettingUpdated,
          resourceType: "supplier",
          resourceId: supplier.id,
          actorUserId: admin.id,
          actorRole: admin.role,
          previousValue: auditSnapshot(supplier, ["subscriptionTier", "commissionRateBps"]),
          newValue: { subscriptionTier, commissionRateBps },
        },
        tx,
      );
    });

    revalidateSupplier(supplier.id, supplier.slug);
    return actionSuccess({ id: supplier.id });
  } catch (error) {
    return toActionError(error, "setSupplierCommercialsAction");
  }
}

function revalidateSupplier(supplierId: string, slug: string): void {
  revalidatePath("/admin/suppliers");
  revalidatePath(`/admin/suppliers/${supplierId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/supplier/verification");
  revalidatePath("/supplier/dashboard");
  revalidatePath(`/marketplace/suppliers/${slug}`);
  revalidatePath("/marketplace");
}

// ---------------------------------------------------------------------------
// Product moderation
// ---------------------------------------------------------------------------

/**
 * Approves or rejects a listing.
 *
 * Moderation is what stops the marketplace filling with placeholder prices and
 * "call for quote" listings, which is the failure mode of every classifieds site
 * this product is meant to beat.
 */
export async function moderateProductAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const admin = await requireAdmin();
    await enforceRateLimit("mutation", admin.id);

    const parsed = productModerationSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check the highlighted fields.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }
    const { productId, decision, reason } = parsed.data;

    const product = await db.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: {
        id: true,
        name: true,
        status: true,
        supplier: { select: { id: true, userId: true, slug: true } },
      },
    });
    if (!product) throw new NotFoundError("product");

    const status = decision === "APPROVE" ? "ACTIVE" : "REJECTED";
    if (product.status === status) return actionSuccess({ id: product.id });

    await db.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: product.id },
        data: { status, rejectionReason: decision === "REJECT" ? (reason ?? null) : null },
      });
      await recordAudit(
        {
          action:
            decision === "APPROVE" ? AUDIT_ACTIONS.productApproved : AUDIT_ACTIONS.productRejected,
          resourceType: "product",
          resourceId: product.id,
          actorUserId: admin.id,
          actorRole: admin.role,
          previousValue: { status: product.status },
          newValue: { status, reason: reason ?? null },
        },
        tx,
      );
    });

    await notify({
      userId: product.supplier.userId,
      type: "SUPPLIER_VERIFICATION_UPDATE",
      title: decision === "APPROVE" ? "A listing is live" : "A listing needs changes",
      body:
        decision === "APPROVE"
          ? `${product.name} is now visible to customers.`
          : `${product.name}: ${reason ?? "BuildLink could not approve this listing."}`,
      linkUrl: `/supplier/products/${product.id}`,
    });

    revalidatePath("/admin/products");
    revalidatePath("/admin/dashboard");
    revalidatePath("/supplier/products");
    revalidatePath(`/supplier/products/${product.id}`);
    revalidatePath("/marketplace");
    revalidatePath(`/marketplace/products/${product.id}`);
    revalidatePath(`/marketplace/suppliers/${product.supplier.slug}`);
    return actionSuccess({ id: product.id });
  } catch (error) {
    return toActionError(error, "moderateProductAction");
  }
}

// ---------------------------------------------------------------------------
// Disputes
// ---------------------------------------------------------------------------

/**
 * Moves a dispute along and records the outcome.
 *
 * Both parties are told the same thing at the same time. A dispute resolved in
 * private is worth nothing to the customer who raised it.
 */
export async function decideDisputeAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const admin = await requireAdmin();
    await enforceRateLimit("mutation", admin.id);

    const parsed = disputeDecisionSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check the highlighted fields.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }
    const { disputeId, status, resolution } = parsed.data;

    const dispute = await db.dispute.findUnique({
      where: { id: disputeId },
      select: {
        id: true,
        status: true,
        raisedById: true,
        orderId: true,
        order: { select: { orderNumber: true, customerId: true } },
        supplier: { select: { id: true, userId: true } },
      },
    });
    if (!dispute) throw new NotFoundError("dispute");
    if (dispute.status === status && status === "UNDER_REVIEW") {
      return actionSuccess({ id: dispute.id });
    }

    const closing = status === "RESOLVED" || status === "CLOSED";

    await db.$transaction(async (tx) => {
      await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          status,
          resolution: resolution ?? null,
          resolvedById: closing ? admin.id : null,
          resolvedAt: closing ? new Date() : null,
        },
      });
      await recordAudit(
        {
          action: closing ? AUDIT_ACTIONS.disputeResolved : AUDIT_ACTIONS.disputeStatusChanged,
          resourceType: "dispute",
          resourceId: dispute.id,
          actorUserId: admin.id,
          actorRole: admin.role,
          previousValue: { status: dispute.status },
          newValue: { status, resolution: resolution ?? null },
        },
        tx,
      );
    });

    const title = closing ? "Your dispute has been decided" : "BuildLink is reviewing your dispute";
    const body = closing
      ? `Order ${dispute.order.orderNumber}: ${resolution}`
      : `We are looking into order ${dispute.order.orderNumber} and will come back to you.`;

    for (const userId of new Set([dispute.order.customerId, dispute.supplier.userId])) {
      await notify({
        userId,
        type: "DISPUTE_UPDATE",
        title,
        body,
        linkUrl: `/orders/${dispute.orderId}`,
      });
    }

    revalidatePath("/admin/disputes");
    revalidatePath(`/admin/disputes/${dispute.id}`);
    revalidatePath("/admin/dashboard");
    revalidatePath(`/orders/${dispute.orderId}`);
    revalidatePath(`/supplier/orders/${dispute.orderId}`);
    return actionSuccess({ id: dispute.id });
  } catch (error) {
    return toActionError(error, "decideDisputeAction");
  }
}

// ---------------------------------------------------------------------------
// Review moderation
// ---------------------------------------------------------------------------

/**
 * Hides, restores or reopens a review.
 *
 * Hiding is reserved for abuse and mistaken identity, never for an unflattering
 * but accurate review — a rating nobody believes is worse for suppliers than a
 * bad one. The supplier's average is recomputed either way.
 */
export async function moderateReviewAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const admin = await requireAdmin();
    await enforceRateLimit("mutation", admin.id);

    const parsed = reviewModerationSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check the highlighted fields.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }
    const { reviewId, action, reason } = parsed.data;

    const review = await db.review.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        status: true,
        customerId: true,
        orderId: true,
        supplier: { select: { id: true, slug: true } },
      },
    });
    if (!review) throw new NotFoundError("review");

    const data: Prisma.ReviewUpdateInput =
      action === "HIDE"
        ? { status: "HIDDEN", hiddenReason: reason ?? null }
        : action === "PUBLISH"
          ? { status: "PUBLISHED", hiddenReason: null }
          : { amendmentAllowed: true };

    await db.$transaction(async (tx) => {
      await tx.review.update({ where: { id: review.id }, data });
      await recordAudit(
        {
          action:
            action === "ALLOW_AMENDMENT"
              ? AUDIT_ACTIONS.reviewAmendmentAuthorised
              : AUDIT_ACTIONS.reviewHidden,
          resourceType: "review",
          resourceId: review.id,
          actorUserId: admin.id,
          actorRole: admin.role,
          previousValue: { status: review.status },
          newValue: { action, reason: reason ?? null },
        },
        tx,
      );
      if (action !== "ALLOW_AMENDMENT") {
        await recalculateSupplierRating(review.supplier.id, tx);
      }
    });

    if (action === "ALLOW_AMENDMENT") {
      await notify({
        userId: review.customerId,
        type: "REVIEW_REMINDER",
        title: "You can update your review",
        body: "BuildLink has reopened your review for this order so you can change it.",
        linkUrl: `/orders/${review.orderId}/review`,
      });
    }

    revalidatePath("/admin/reviews");
    revalidatePath(`/marketplace/suppliers/${review.supplier.slug}`);
    return actionSuccess({ id: review.id });
  } catch (error) {
    return toActionError(error, "moderateReviewAction");
  }
}

// ---------------------------------------------------------------------------
// Platform settings
// ---------------------------------------------------------------------------

/**
 * Saves the commercial configuration.
 *
 * Commission is off at launch and turning it on is a decision with real
 * consequences for every supplier, so it is a setting with an audit trail rather
 * than a constant in a deployment.
 */
export async function savePlatformSettingsAction(
  _previous: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  try {
    const admin = await requireAdmin();
    await enforceRateLimit("mutation", admin.id);

    if (admin.role !== "SUPER_ADMIN") {
      throw new AuthorisationError("Only a super administrator can change platform settings.");
    }

    const parsed = platformSettingsSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check the highlighted fields.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }

    const existing = await db.platformSetting.findMany({ select: { key: true, value: true } });
    const previousByKey = new Map(existing.map((row) => [row.key, row.value]));

    let updated = 0;
    for (const key of PLATFORM_SETTING_KEYS) {
      const value = parsed.data[key];
      const previous = previousByKey.get(key);
      if (previous === value) continue;

      await db.platformSetting.upsert({
        where: { key },
        update: { value, updatedById: admin.id },
        create: {
          key,
          value,
          description: PLATFORM_SETTING_HINTS[key],
          updatedById: admin.id,
        },
      });

      await recordAudit({
        action: AUDIT_ACTIONS.platformSettingUpdated,
        resourceType: "platform_setting",
        resourceId: key,
        actorUserId: admin.id,
        actorRole: admin.role,
        previousValue: { value: previous ?? null },
        newValue: { value },
      });
      updated += 1;
    }

    revalidatePath("/admin/settings");
    revalidatePath("/admin/dashboard");
    return actionSuccess({ updated });
  } catch (error) {
    return toActionError(error, "savePlatformSettingsAction");
  }
}
