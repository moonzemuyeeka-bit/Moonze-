"use server";

import { revalidatePath } from "next/cache";
import type { ProductStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSupplier } from "@/lib/auth/guards";
import { AUDIT_ACTIONS, auditSnapshot, recordAudit } from "@/lib/audit";
import { ANALYTICS_EVENTS, track } from "@/lib/services/analytics";
import { notify } from "@/lib/services/notifications";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  buildStorageKey,
  DOCUMENT_MIME_TYPES,
  IMAGE_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
  MAX_IMAGE_BYTES,
  storage,
  validateUpload,
} from "@/lib/services/storage";
import {
  actionFailure,
  actionSuccess,
  ConflictError,
  NotFoundError,
  toActionError,
  ValidationError,
  type ActionResult,
} from "@/lib/errors";
import { fieldErrorsFrom, formDataToObject } from "@/lib/validation/shared";
import {
  productImageSchema,
  productSchema,
  productStatusSchema,
  removeProductImageSchema,
  removeSupplierDocumentSchema,
  stockAdjustmentSchema,
  supplierDocumentUploadSchema,
  supplierSettingsSchema,
} from "@/lib/validation/supplier";
import { slugify } from "@/lib/utils";
import { SUPPLIER_DOCUMENT_TYPE_LABELS } from "@/lib/labels";

/**
 * Supplier console mutations.
 *
 * The supplier is always resolved from the session by `requireSupplier`, so a
 * `supplierId` never arrives from the client. Listings a customer can buy from
 * go through moderation: a new or re-priced product returns to
 * `PENDING_APPROVAL` rather than going straight live.
 */

export type ProductActionState = ActionResult<{ productId: string; status: ProductStatus }> | null;
export type SupplierActionState = ActionResult<{ supplierId: string }> | null;
export type DocumentActionState = ActionResult<{ documentId: string }> | null;

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

/**
 * Creates or updates a listing.
 *
 * Price, name and unit are the terms of a public offer, so an edit to any of
 * them sends an approved listing back for review. Stock and description changes
 * do not, because a supplier must be able to correct those instantly.
 */
export async function saveProductAction(
  _previous: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  try {
    const { user, supplier } = await requireSupplier();
    await enforceRateLimit("mutation", user.id);

    const parsed = productSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check the highlighted fields.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }
    const input = parsed.data;

    const category = await db.productCategory.findFirst({
      where: { id: input.categoryId, isActive: true },
      select: { id: true, name: true },
    });
    if (!category) {
      throw new ValidationError("Choose a category for this product.", {
        categoryId: ["Select a category."],
      });
    }

    const existing = input.productId
      ? await db.product.findFirst({
          where: { id: input.productId, supplierId: supplier.id },
          select: {
            id: true,
            name: true,
            status: true,
            priceMinor: true,
            unit: true,
            stockQuantity: true,
            categoryId: true,
          },
        })
      : null;

    if (input.productId && !existing) throw new NotFoundError("product");

    const slug = await uniqueProductSlug(supplier.id, input.name, existing?.id ?? null);
    const status = nextProductStatus({
      intent: input.intent,
      current: existing?.status ?? null,
      termsChanged:
        existing !== null &&
        (existing.name !== input.name ||
          existing.priceMinor !== input.priceMinor ||
          existing.unit !== input.unit ||
          existing.categoryId !== input.categoryId),
    });

    const data = {
      categoryId: input.categoryId,
      name: input.name,
      slug,
      brand: input.brand ?? null,
      description: input.description ?? null,
      unit: input.unit,
      priceMinor: input.priceMinor,
      minimumOrderQuantity: input.minimumOrderQuantity,
      stockQuantity: input.stockQuantity,
      lowStockThreshold: input.lowStockThreshold,
      deliveryAvailable: input.deliveryAvailable,
      status,
      // A resubmission clears the previous moderation decision.
      rejectionReason: status === "PENDING_APPROVAL" ? null : undefined,
    };

    const product = await db.$transaction(async (tx) => {
      const saved = existing
        ? await tx.product.update({
            where: { id: existing.id },
            data,
            select: { id: true, status: true },
          })
        : await tx.product.create({
            data: { ...data, supplierId: supplier.id },
            select: { id: true, status: true },
          });

      // Inventory is a separate record so stock movements are auditable apart
      // from catalogue edits; it is created with the product and kept in step.
      await tx.inventory.upsert({
        where: { productId: saved.id },
        update: { quantityOnHand: input.stockQuantity },
        create: { productId: saved.id, quantityOnHand: input.stockQuantity },
      });

      await recordAudit(
        {
          action: existing ? AUDIT_ACTIONS.productUpdated : AUDIT_ACTIONS.productCreated,
          resourceType: "product",
          resourceId: saved.id,
          actorUserId: user.id,
          actorRole: user.role,
          previousValue: existing
            ? auditSnapshot(existing, ["name", "priceMinor", "unit", "status", "stockQuantity"])
            : null,
          newValue: {
            name: input.name,
            priceMinor: input.priceMinor,
            unit: input.unit,
            status: saved.status,
            stockQuantity: input.stockQuantity,
          },
        },
        tx,
      );

      return saved;
    });

    if (!existing) {
      await track({
        name: ANALYTICS_EVENTS.productListed,
        userId: user.id,
        properties: { categoryId: input.categoryId, priceMinor: input.priceMinor },
      });
    }

    revalidateCatalogue(product.id);
    return actionSuccess({ productId: product.id, status: product.status });
  } catch (error) {
    return toActionError(error, "saveProductAction");
  }
}

/**
 * Moderation rules for a save.
 *
 * A draft stays a draft until the supplier publishes it. A live listing whose
 * commercial terms changed goes back into the queue; everything else keeps the
 * status it had.
 */
function nextProductStatus(input: {
  intent: "draft" | "publish";
  current: ProductStatus | null;
  termsChanged: boolean;
}): ProductStatus {
  if (input.intent === "draft") return "DRAFT";
  if (input.current === null) return "PENDING_APPROVAL";
  if (input.current === "ACTIVE") return input.termsChanged ? "PENDING_APPROVAL" : "ACTIVE";
  if (input.current === "INACTIVE") return "INACTIVE";
  return "PENDING_APPROVAL";
}

/** Publishes, hides or archives an existing listing. */
export async function setProductStatusAction(
  _previous: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  try {
    const { user, supplier } = await requireSupplier();
    await enforceRateLimit("mutation", user.id);

    const parsed = productStatusSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return actionFailure("That change is not valid.", "VALIDATION_ERROR");

    const product = await db.product.findFirst({
      where: { id: parsed.data.productId, supplierId: supplier.id },
      select: { id: true, status: true, name: true },
    });
    if (!product) throw new NotFoundError("product");

    // Only BuildLink can make a listing live; a supplier can offer it for
    // review, hide it, or retire it.
    const target: ProductStatus =
      parsed.data.status === "ACTIVE"
        ? product.status === "INACTIVE"
          ? "ACTIVE"
          : "PENDING_APPROVAL"
        : parsed.data.status;

    if (target === product.status) {
      return actionSuccess({ productId: product.id, status: product.status });
    }

    await db.product.update({
      where: { id: product.id },
      data: {
        status: target,
        deletedAt: target === "ARCHIVED" ? new Date() : null,
      },
    });

    await recordAudit({
      action:
        target === "ARCHIVED" ? AUDIT_ACTIONS.productArchived : AUDIT_ACTIONS.productUpdated,
      resourceType: "product",
      resourceId: product.id,
      actorUserId: user.id,
      actorRole: user.role,
      previousValue: { status: product.status },
      newValue: { status: target },
    });

    revalidateCatalogue(product.id);
    return actionSuccess({ productId: product.id, status: target });
  } catch (error) {
    return toActionError(error, "setProductStatusAction");
  }
}

/** Records a stock count. Kept separate so it can be done in seconds from a phone. */
export async function adjustStockAction(
  _previous: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  try {
    const { user, supplier } = await requireSupplier();
    await enforceRateLimit("mutation", user.id);

    const parsed = stockAdjustmentSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Enter the quantity you have on hand.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }

    const product = await db.product.findFirst({
      where: { id: parsed.data.productId, supplierId: supplier.id },
      select: { id: true, name: true, stockQuantity: true, status: true },
    });
    if (!product) throw new NotFoundError("product");

    const quantity = parsed.data.quantityOnHand;

    await db.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: product.id },
        data: { stockQuantity: quantity },
      });
      await tx.inventory.upsert({
        where: { productId: product.id },
        update: {
          quantityOnHand: quantity,
          restockedAt: quantity > product.stockQuantity ? new Date() : undefined,
        },
        create: { productId: product.id, quantityOnHand: quantity },
      });
      await recordAudit(
        {
          action: AUDIT_ACTIONS.productStockAdjusted,
          resourceType: "product",
          resourceId: product.id,
          actorUserId: user.id,
          actorRole: user.role,
          previousValue: { stockQuantity: product.stockQuantity },
          newValue: { stockQuantity: quantity, reason: parsed.data.reason ?? null },
        },
        tx,
      );
    });

    revalidateCatalogue(product.id);
    return actionSuccess({ productId: product.id, status: product.status });
  } catch (error) {
    return toActionError(error, "adjustStockAction");
  }
}

/** Adds a photograph to a listing. */
export async function uploadProductImageAction(
  _previous: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  try {
    const { user, supplier } = await requireSupplier();
    await enforceRateLimit("upload", user.id);

    const parsed = productImageSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return actionFailure("That upload is not valid.", "VALIDATION_ERROR");

    const product = await db.product.findFirst({
      where: { id: parsed.data.productId, supplierId: supplier.id },
      select: { id: true, status: true, _count: { select: { images: true } } },
    });
    if (!product) throw new NotFoundError("product");
    if (product._count.images >= 6) {
      throw new ConflictError("A listing can show up to six photographs.");
    }

    const file = formData.get("image");
    if (!(file instanceof File)) {
      throw new ValidationError("Choose a photograph to upload.", {
        image: ["Select an image file."],
      });
    }

    const upload = await validateUpload(file, {
      allowedMimeTypes: IMAGE_MIME_TYPES,
      maxBytes: MAX_IMAGE_BYTES,
      fieldName: "image",
    });

    const key = buildStorageKey({
      scope: "product-images",
      ownerId: product.id,
      extension: upload.extension,
    });

    await storage().put({
      key,
      body: upload.buffer,
      contentType: upload.contentType,
      visibility: "public",
    });

    await db.productImage.create({
      data: {
        productId: product.id,
        fileKey: key,
        altText: parsed.data.altText ?? null,
        sortOrder: product._count.images,
      },
    });

    revalidateCatalogue(product.id);
    return actionSuccess({ productId: product.id, status: product.status });
  } catch (error) {
    return toActionError(error, "uploadProductImageAction");
  }
}

export async function removeProductImageAction(
  _previous: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  try {
    const { user, supplier } = await requireSupplier();
    await enforceRateLimit("mutation", user.id);

    const parsed = removeProductImageSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return actionFailure("That image is not valid.", "VALIDATION_ERROR");

    const image = await db.productImage.findFirst({
      where: { id: parsed.data.imageId, product: { supplierId: supplier.id } },
      select: { id: true, fileKey: true, product: { select: { id: true, status: true } } },
    });
    if (!image) throw new NotFoundError("image");

    await db.productImage.delete({ where: { id: image.id } });
    // The row is the record of the photograph; a failed object delete must not
    // leave a listing pointing at an image the supplier believes is gone.
    await storage()
      .remove(image.fileKey)
      .catch((error: unknown) => {
        console.error("[buildlink] failed to remove product image object:", error);
      });

    revalidateCatalogue(image.product.id);
    return actionSuccess({ productId: image.product.id, status: image.product.status });
  } catch (error) {
    return toActionError(error, "removeProductImageAction");
  }
}

async function uniqueProductSlug(
  supplierId: string,
  name: string,
  currentId: string | null,
): Promise<string> {
  const base = slugify(name) || "product";
  let candidate = base;
  let counter = 2;

  for (;;) {
    const clash = await db.product.findFirst({
      where: {
        supplierId,
        slug: candidate,
        ...(currentId ? { NOT: { id: currentId } } : {}),
      },
      select: { id: true },
    });
    if (!clash) return candidate;
    candidate = `${base}-${counter}`;
    counter += 1;
    if (counter > 100) throw new ConflictError("Could not create a unique web address for that name.");
  }
}

function revalidateCatalogue(productId: string): void {
  revalidatePath("/supplier/products");
  revalidatePath(`/supplier/products/${productId}`);
  revalidatePath("/supplier/dashboard");
  revalidatePath("/marketplace");
  revalidatePath(`/marketplace/products/${productId}`);
}

// ---------------------------------------------------------------------------
// Business settings
// ---------------------------------------------------------------------------

export async function saveSupplierSettingsAction(
  _previous: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  try {
    const { user, supplier } = await requireSupplier();
    await enforceRateLimit("mutation", user.id);

    const raw = formDataToObject(formData);
    const parsed = supplierSettingsSchema.safeParse({
      ...raw,
      categoryIds: formData.getAll("categoryIds"),
    });
    if (!parsed.success) {
      return actionFailure(
        "Please check the highlighted fields.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }
    const input = parsed.data;

    const [province, categories, previous] = await Promise.all([
      db.province.findUnique({ where: { id: input.provinceId }, select: { id: true } }),
      db.productCategory.findMany({
        where: { id: { in: input.categoryIds }, parentId: null },
        select: { id: true },
      }),
      db.supplierProfile.findUniqueOrThrow({
        where: { id: supplier.id },
        select: {
          businessName: true,
          phone: true,
          email: true,
          deliveryAvailable: true,
          minimumOrderMinor: true,
          deliveryBaseFeeMinor: true,
          registrationNumber: true,
        },
      }),
    ]);

    if (!province) {
      throw new ValidationError("Choose a province.", { provinceId: ["Select a province."] });
    }
    if (categories.length === 0) {
      throw new ValidationError("Choose at least one category.", {
        categoryIds: ["Select the categories your business supplies."],
      });
    }

    if (input.districtId) {
      const district = await db.district.findFirst({
        where: { id: input.districtId, provinceId: input.provinceId },
        select: { id: true },
      });
      if (!district) {
        throw new ValidationError("That district is not in the province you chose.", {
          districtId: ["Choose a district in the selected province."],
        });
      }
    }

    await db.$transaction(async (tx) => {
      await tx.supplierProfile.update({
        where: { id: supplier.id },
        data: {
          businessName: input.businessName,
          description: input.description ?? null,
          phone: input.phone,
          email: input.email,
          provinceId: input.provinceId,
          districtId: input.districtId ?? null,
          address: input.address ?? null,
          yearsOperating: input.yearsOperating,
          registrationNumber: input.registrationNumber ?? null,
          taxpayerNumber: input.taxpayerNumber ?? null,
          // Declaring a registration number is a claim, not proof: the status
          // only reaches VERIFIED when an administrator reviews the documents.
          businessRegistrationStatus: input.registrationNumber
            ? previous.registrationNumber === input.registrationNumber
              ? undefined
              : "SELF_DECLARED"
            : "NOT_PROVIDED",
          deliveryAvailable: input.deliveryAvailable,
          deliveryNotes: input.deliveryNotes ?? null,
          minimumOrderMinor: input.minimumOrderMinor,
          deliveryBaseFeeMinor: input.deliveryBaseFeeMinor,
          deliveryFreeAboveMinor: input.deliveryFreeAboveMinor,
          categories: { set: categories.map((category) => ({ id: category.id })) },
        },
      });

      await recordAudit(
        {
          action: AUDIT_ACTIONS.supplierApplied,
          resourceType: "supplier",
          resourceId: supplier.id,
          actorUserId: user.id,
          actorRole: user.role,
          previousValue: auditSnapshot(previous, [
            "businessName",
            "phone",
            "email",
            "deliveryAvailable",
            "minimumOrderMinor",
            "deliveryBaseFeeMinor",
          ]),
          newValue: {
            businessName: input.businessName,
            phone: input.phone,
            email: input.email,
            deliveryAvailable: input.deliveryAvailable,
            minimumOrderMinor: input.minimumOrderMinor,
            deliveryBaseFeeMinor: input.deliveryBaseFeeMinor,
          },
        },
        tx,
      );
    });

    revalidatePath("/supplier/settings");
    revalidatePath("/supplier/dashboard");
    revalidatePath(`/marketplace/suppliers/${supplier.slug}`);
    return actionSuccess({ supplierId: supplier.id });
  } catch (error) {
    return toActionError(error, "saveSupplierSettingsAction");
  }
}

export async function uploadSupplierLogoAction(
  _previous: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  try {
    const { user, supplier } = await requireSupplier();
    await enforceRateLimit("upload", user.id);

    const file = formData.get("logo");
    if (!(file instanceof File)) {
      throw new ValidationError("Choose an image to upload.", { logo: ["Select an image file."] });
    }

    const upload = await validateUpload(file, {
      allowedMimeTypes: IMAGE_MIME_TYPES,
      maxBytes: MAX_IMAGE_BYTES,
      fieldName: "logo",
    });

    const key = buildStorageKey({
      scope: "supplier-logos",
      ownerId: supplier.id,
      extension: upload.extension,
    });

    await storage().put({
      key,
      body: upload.buffer,
      contentType: upload.contentType,
      visibility: "public",
    });

    const previous = await db.supplierProfile.findUniqueOrThrow({
      where: { id: supplier.id },
      select: { logoKey: true },
    });

    await db.supplierProfile.update({ where: { id: supplier.id }, data: { logoKey: key } });

    if (previous.logoKey) {
      await storage()
        .remove(previous.logoKey)
        .catch(() => undefined);
    }

    revalidatePath("/supplier/settings");
    revalidatePath(`/marketplace/suppliers/${supplier.slug}`);
    return actionSuccess({ supplierId: supplier.id });
  } catch (error) {
    return toActionError(error, "uploadSupplierLogoAction");
  }
}

// ---------------------------------------------------------------------------
// Verification documents
// ---------------------------------------------------------------------------

/**
 * Uploads a verification document.
 *
 * Documents are stored privately and served only through the authorised file
 * route: a PACRA certificate and a director's NRC are exactly the material that
 * must never sit behind a guessable public URL.
 */
export async function uploadSupplierDocumentAction(
  _previous: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  try {
    const { user, supplier } = await requireSupplier();
    await enforceRateLimit("upload", user.id);

    const parsed = supplierDocumentUploadSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Choose which document you are uploading.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }

    const file = formData.get("document");
    if (!(file instanceof File)) {
      throw new ValidationError("Choose a file to upload.", {
        document: ["Select a PDF or photograph."],
      });
    }

    const upload = await validateUpload(file, {
      allowedMimeTypes: DOCUMENT_MIME_TYPES,
      maxBytes: MAX_DOCUMENT_BYTES,
      fieldName: "document",
    });

    const key = buildStorageKey({
      scope: "supplier-documents",
      ownerId: supplier.id,
      extension: upload.extension,
    });

    await storage().put({
      key,
      body: upload.buffer,
      contentType: upload.contentType,
      visibility: "private",
    });

    const document = await db.$transaction(async (tx) => {
      const created = await tx.supplierDocument.create({
        data: {
          supplierId: supplier.id,
          type: parsed.data.type,
          fileKey: key,
          fileName: upload.originalName,
          mimeType: upload.contentType,
          sizeBytes: upload.sizeBytes,
          reviewStatus: "PENDING",
        },
        select: { id: true },
      });

      // Uploading documents moves the business from "self-declared" to
      // "documents submitted" and reopens the verification review.
      await tx.supplierProfile.update({
        where: { id: supplier.id },
        data: {
          businessRegistrationStatus: "DOCUMENTS_SUBMITTED",
          verificationStatus:
            supplier.verificationStatus === "VERIFIED" ? undefined : "PENDING",
        },
      });

      const openReview = await tx.supplierVerification.findFirst({
        where: { supplierId: supplier.id, status: "PENDING" },
        select: { id: true },
      });
      if (!openReview) {
        await tx.supplierVerification.create({
          data: { supplierId: supplier.id, status: "PENDING" },
        });
      }

      return created;
    });

    await notify({
      userId: user.id,
      type: "SUPPLIER_VERIFICATION_UPDATE",
      title: "Document received",
      body: `We have your ${SUPPLIER_DOCUMENT_TYPE_LABELS[parsed.data.type].toLowerCase()}. BuildLink will review it and update your verification status.`,
      linkUrl: "/supplier/verification",
    });

    revalidatePath("/supplier/verification");
    revalidatePath("/supplier/dashboard");
    return actionSuccess({ documentId: document.id });
  } catch (error) {
    return toActionError(error, "uploadSupplierDocumentAction");
  }
}

export async function removeSupplierDocumentAction(
  _previous: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  try {
    const { user, supplier } = await requireSupplier();
    await enforceRateLimit("mutation", user.id);

    const parsed = removeSupplierDocumentSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return actionFailure("That document is not valid.", "VALIDATION_ERROR");

    const document = await db.supplierDocument.findFirst({
      where: { id: parsed.data.documentId, supplierId: supplier.id },
      select: { id: true, fileKey: true, reviewStatus: true },
    });
    if (!document) throw new NotFoundError("document");

    // An accepted document is part of the verification record and stays.
    if (document.reviewStatus === "APPROVED") {
      throw new ConflictError(
        "This document has been accepted as part of your verification and cannot be removed.",
      );
    }

    await db.supplierDocument.delete({ where: { id: document.id } });
    await storage()
      .remove(document.fileKey)
      .catch(() => undefined);

    await recordAudit({
      action: AUDIT_ACTIONS.supplierDocumentReviewed,
      resourceType: "supplier_document",
      resourceId: document.id,
      actorUserId: user.id,
      actorRole: user.role,
      newValue: { removedBySupplier: true },
    });

    revalidatePath("/supplier/verification");
    return actionSuccess({ documentId: document.id });
  } catch (error) {
    return toActionError(error, "removeSupplierDocumentAction");
  }
}