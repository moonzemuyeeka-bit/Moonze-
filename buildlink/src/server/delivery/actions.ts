"use server";

import { revalidatePath } from "next/cache";
import type { DeliveryStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin, requireDeliveryProvider, requireUser } from "@/lib/auth/guards";
import {
  applyDeliveryStatus,
  assignDelivery,
  loadDeliveryForActor,
  type DeliveryForActor,
} from "@/server/delivery/service";
import {
  actorCanTransitionDelivery,
  requiresProofOfDelivery,
} from "@/lib/domain/delivery-status";
import { AUDIT_ACTIONS, auditSnapshot, recordAudit } from "@/lib/audit";
import { ANALYTICS_EVENTS, track } from "@/lib/services/analytics";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  buildStorageKey,
  IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  storage,
  validateUpload,
} from "@/lib/services/storage";
import {
  actionFailure,
  actionSuccess,
  AuthorisationError,
  ConflictError,
  toActionError,
  ValidationError,
  type ActionResult,
} from "@/lib/errors";
import { fieldErrorsFrom, formDataToObject } from "@/lib/validation/shared";
import {
  assignDeliverySchema,
  cancelDeliverySchema,
  claimDeliverySchema,
  completeDeliverySchema,
  deliveryFailureSchema,
  deliveryProviderSettingsSchema,
  deliveryStatusUpdateSchema,
  removeServiceAreaSchema,
  removeVehicleSchema,
  serviceAreaSchema,
  vehicleSchema,
} from "@/lib/validation/delivery";

/**
 * Delivery mutations.
 *
 * Three different actors drive one record, so each action states plainly which
 * of them it is for and re-derives that from the session rather than the form:
 * a supplier assigns and dispatches, a transporter claims and progresses a job,
 * a customer may cancel only while nothing has moved.
 */

export type DeliveryActionState = ActionResult<{ status: DeliveryStatus }> | null;

// ---------------------------------------------------------------------------
// Supplier side
// ---------------------------------------------------------------------------

export async function assignDeliveryAction(
  _previous: DeliveryActionState,
  formData: FormData,
): Promise<DeliveryActionState> {
  try {
    const user = await requireUser();
    await enforceRateLimit("mutation", user.id);

    const parsed = assignDeliverySchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check the delivery details.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }
    const input = parsed.data;

    const delivery = await loadDeliveryForActor(input.deliveryId, user);
    if (!delivery.viewer.isSupplier && !delivery.viewer.isAdmin) {
      throw new AuthorisationError("Only the supplier on this order can assign a transporter.");
    }

    // A vehicle must belong to the transporter being given the job.
    if (input.vehicleId) {
      const vehicle = await db.vehicle.findFirst({
        where: { id: input.vehicleId, providerId: input.providerId, isActive: true },
        select: { id: true },
      });
      if (!vehicle) {
        throw new ValidationError("Choose one of that transporter's vehicles.", {
          vehicleId: ["That vehicle is not available."],
        });
      }
    }

    const scheduledFor = input.scheduledFor ? new Date(input.scheduledFor) : null;
    if (scheduledFor && Number.isNaN(scheduledFor.getTime())) {
      throw new ValidationError("Enter a valid date and time.", {
        scheduledFor: ["Enter a valid date and time."],
      });
    }

    await assignDelivery({
      delivery,
      providerId: input.providerId,
      vehicleId: input.vehicleId ?? null,
      feeMinor: input.feeMinor ?? null,
      scheduledFor,
      note: input.note ?? null,
      actor: user,
    });

    await track({
      name: ANALYTICS_EVENTS.deliveryAssigned,
      userId: user.id,
      properties: { deliveryId: delivery.id, providerId: input.providerId },
    });

    revalidateDelivery(delivery);
    return actionSuccess({ status: "ASSIGNED" as DeliveryStatus });
  } catch (error) {
    return toActionError(error, "assignDeliveryAction");
  }
}

// ---------------------------------------------------------------------------
// Transporter side
// ---------------------------------------------------------------------------

/** A transporter taking an unclaimed job from the board. */
export async function claimDeliveryAction(
  _previous: DeliveryActionState,
  formData: FormData,
): Promise<DeliveryActionState> {
  try {
    const { user, providerId } = await requireDeliveryProvider();
    await enforceRateLimit("mutation", user.id);

    const parsed = claimDeliverySchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return actionFailure("That job is not valid.", "VALIDATION_ERROR");

    const provider = await db.deliveryProvider.findUnique({
      where: { id: providerId },
      select: { isAcceptingJobs: true, verificationStatus: true },
    });
    if (provider?.verificationStatus === "SUSPENDED") {
      throw new AuthorisationError(
        "Your transport business is suspended. Contact BuildLink support.",
      );
    }

    if (parsed.data.vehicleId) {
      const vehicle = await db.vehicle.findFirst({
        where: { id: parsed.data.vehicleId, providerId, isActive: true },
        select: { id: true },
      });
      if (!vehicle) {
        throw new ValidationError("Choose one of your own vehicles.", {
          vehicleId: ["That vehicle is not on your fleet."],
        });
      }
    }

    // Claiming is a race: two drivers can tap at the same moment, so the update
    // is conditional on the job still being unclaimed rather than on a read.
    const claimed = await db.delivery.updateMany({
      where: {
        id: parsed.data.deliveryId,
        providerId: null,
        status: "REQUESTED",
        method: "THIRD_PARTY_DELIVERY",
      },
      data: {
        providerId,
        vehicleId: parsed.data.vehicleId ?? null,
        status: "ACCEPTED",
      },
    });
    if (claimed.count === 0) {
      throw new ConflictError("Another transporter has already taken this job.");
    }

    const delivery = await loadDeliveryForActor(parsed.data.deliveryId, user);

    await db.deliveryEvent.create({
      data: {
        deliveryId: delivery.id,
        fromStatus: "REQUESTED",
        toStatus: "ACCEPTED",
        note: "Job accepted by transporter.",
        actorUserId: user.id,
      },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.deliveryAssigned,
      resourceType: "delivery",
      resourceId: delivery.id,
      actorUserId: user.id,
      actorRole: user.role,
      newValue: { providerId, status: "ACCEPTED", claimed: true },
    });

    await track({
      name: ANALYTICS_EVENTS.deliveryAssigned,
      userId: user.id,
      properties: { deliveryId: delivery.id, providerId, claimed: true },
    });

    revalidateDelivery(delivery);
    revalidatePath("/delivery");
    return actionSuccess({ status: "ACCEPTED" as DeliveryStatus });
  } catch (error) {
    return toActionError(error, "claimDeliveryAction");
  }
}

/** Moves a delivery along: accepted → picked up → in transit. */
export async function updateDeliveryStatusAction(
  _previous: DeliveryActionState,
  formData: FormData,
): Promise<DeliveryActionState> {
  try {
    const user = await requireUser();
    await enforceRateLimit("mutation", user.id);

    const parsed = deliveryStatusUpdateSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return actionFailure("That update is not valid.", "VALIDATION_ERROR");
    const input = parsed.data;

    const delivery = await loadDeliveryForActor(input.deliveryId, user);
    assertActorMayMove(delivery, user.role, input.status);

    if (input.status === "DELIVERED") {
      throw new ValidationError(
        "Completing a delivery needs the name of the person who received the goods.",
      );
    }

    await applyDeliveryStatus({
      delivery,
      to: input.status,
      actor: user,
      note: input.note ?? null,
    });

    revalidateDelivery(delivery);
    return actionSuccess({ status: input.status });
  } catch (error) {
    return toActionError(error, "updateDeliveryStatusAction");
  }
}

/**
 * Completing a delivery, with proof.
 *
 * A third-party job cannot be closed without a photograph: the transporter is
 * neither the buyer nor the seller, so the proof is what lets the other two
 * agree that the materials arrived.
 */
export async function completeDeliveryAction(
  _previous: DeliveryActionState,
  formData: FormData,
): Promise<DeliveryActionState> {
  try {
    const user = await requireUser();
    await enforceRateLimit("upload", user.id);

    const parsed = completeDeliverySchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please record who received the goods.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }
    const input = parsed.data;

    const delivery = await loadDeliveryForActor(input.deliveryId, user);
    assertActorMayMove(delivery, user.role, "DELIVERED");

    const file = formData.get("proof");
    const hasFile = file instanceof File && file.size > 0;

    if (!hasFile && !delivery.proofFileKey && requiresProofOfDelivery(delivery.method)) {
      throw new ValidationError("A photograph of the delivered goods is required.", {
        proof: ["Attach a photo taken at the delivery point."],
      });
    }

    let proofFileKey: string | null = null;
    if (hasFile) {
      const upload = await validateUpload(file, {
        allowedMimeTypes: IMAGE_MIME_TYPES,
        maxBytes: MAX_IMAGE_BYTES,
        fieldName: "proof",
      });
      const key = buildStorageKey({
        scope: "delivery-proof",
        ownerId: delivery.id,
        extension: upload.extension,
      });
      await storage().put({
        key,
        body: upload.buffer,
        contentType: upload.contentType,
        visibility: "private",
      });
      proofFileKey = key;
    }

    await applyDeliveryStatus({
      delivery,
      to: "DELIVERED",
      actor: user,
      note: input.note ?? null,
      receivedBy: input.receivedBy,
      proofFileKey,
    });

    await track({
      name: ANALYTICS_EVENTS.deliveryCompleted,
      userId: user.id,
      properties: { deliveryId: delivery.id, hasProof: proofFileKey !== null },
    });

    revalidateDelivery(delivery);
    return actionSuccess({ status: "DELIVERED" as DeliveryStatus });
  } catch (error) {
    return toActionError(error, "completeDeliveryAction");
  }
}

export async function failDeliveryAction(
  _previous: DeliveryActionState,
  formData: FormData,
): Promise<DeliveryActionState> {
  try {
    const user = await requireUser();
    await enforceRateLimit("mutation", user.id);

    const parsed = deliveryFailureSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please say what went wrong.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }

    const delivery = await loadDeliveryForActor(parsed.data.deliveryId, user);
    assertActorMayMove(delivery, user.role, "FAILED");

    await applyDeliveryStatus({
      delivery,
      to: "FAILED",
      actor: user,
      failureReason: parsed.data.reason,
    });

    revalidateDelivery(delivery);
    return actionSuccess({ status: "FAILED" as DeliveryStatus });
  } catch (error) {
    return toActionError(error, "failDeliveryAction");
  }
}

export async function cancelDeliveryAction(
  _previous: DeliveryActionState,
  formData: FormData,
): Promise<DeliveryActionState> {
  try {
    const user = await requireUser();
    await enforceRateLimit("mutation", user.id);

    const parsed = cancelDeliverySchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please say why the delivery is being cancelled.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }

    const delivery = await loadDeliveryForActor(parsed.data.deliveryId, user);
    assertActorMayMove(delivery, user.role, "CANCELLED");

    await applyDeliveryStatus({
      delivery,
      to: "CANCELLED",
      actor: user,
      note: parsed.data.reason,
    });

    revalidateDelivery(delivery);
    return actionSuccess({ status: "CANCELLED" as DeliveryStatus });
  } catch (error) {
    return toActionError(error, "cancelDeliveryAction");
  }
}

/**
 * Ownership plus the state machine, in one place.
 *
 * `actorCanTransitionDelivery` answers "may this *kind* of actor make this
 * move?"; this adds "and are they actually on this job?".
 */
function assertActorMayMove(
  delivery: DeliveryForActor,
  role: Parameters<typeof actorCanTransitionDelivery>[0],
  to: DeliveryStatus,
): void {
  const { viewer } = delivery;
  const isParty = viewer.isProvider || viewer.isSupplier || viewer.isCustomer || viewer.isAdmin;
  if (!isParty) throw new AuthorisationError();

  // A supplier delivering with their own fleet acts as the transporter.
  const effectiveRole = viewer.isAdmin
    ? role
    : viewer.isProvider
      ? "DELIVERY_PROVIDER"
      : viewer.isSupplier
        ? "SUPPLIER"
        : "CUSTOMER";

  if (!actorCanTransitionDelivery(effectiveRole, delivery.status, to)) {
    throw new ConflictError(
      `This delivery cannot move from "${delivery.status}" to "${to}" from your side.`,
    );
  }
}

function revalidateDelivery(delivery: DeliveryForActor): void {
  revalidatePath(`/orders/${delivery.orderId}`);
  revalidatePath(`/supplier/orders/${delivery.orderId}`);
  revalidatePath(`/delivery/assigned/${delivery.id}`);
  revalidatePath("/delivery/assigned");
}

// ---------------------------------------------------------------------------
// Fleet
// ---------------------------------------------------------------------------

export type VehicleActionState = ActionResult<{ vehicleId: string }> | null;

export async function saveVehicleAction(
  _previous: VehicleActionState,
  formData: FormData,
): Promise<VehicleActionState> {
  try {
    const { user, providerId } = await requireDeliveryProvider();
    await enforceRateLimit("mutation", user.id);

    const parsed = vehicleSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check the vehicle details.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }
    const input = parsed.data;

    const duplicate = await db.vehicle.findFirst({
      where: {
        providerId,
        registration: input.registration,
        ...(input.vehicleId ? { NOT: { id: input.vehicleId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ValidationError("That registration is already on your fleet.", {
        registration: ["This vehicle is already listed."],
      });
    }

    const data = {
      type: input.type,
      registration: input.registration,
      description: input.description ?? null,
      capacityKg: input.capacityKg,
      capacityCubicMetres: input.capacityCubicMetres,
    };

    const vehicle = input.vehicleId
      ? await db.vehicle.update({
          where: { id: input.vehicleId, providerId },
          data,
          select: { id: true },
        })
      : await db.vehicle.create({
          data: { ...data, providerId },
          select: { id: true },
        });

    revalidatePath("/delivery/fleet");
    return actionSuccess({ vehicleId: vehicle.id });
  } catch (error) {
    return toActionError(error, "saveVehicleAction");
  }
}

/**
 * Retiring a vehicle deactivates it rather than deleting it: past deliveries
 * name the truck that carried them, and that history has to survive.
 */
export async function retireVehicleAction(
  _previous: VehicleActionState,
  formData: FormData,
): Promise<VehicleActionState> {
  try {
    const { user, providerId } = await requireDeliveryProvider();
    await enforceRateLimit("mutation", user.id);

    const parsed = removeVehicleSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return actionFailure("That vehicle is not valid.", "VALIDATION_ERROR");

    const vehicle = await db.vehicle.findFirst({
      where: { id: parsed.data.vehicleId, providerId },
      select: { id: true, isActive: true },
    });
    if (!vehicle) return actionFailure("That vehicle is not on your fleet.", "NOT_FOUND");

    await db.vehicle.update({
      where: { id: vehicle.id },
      data: { isActive: !vehicle.isActive },
    });

    revalidatePath("/delivery/fleet");
    return actionSuccess({ vehicleId: vehicle.id });
  } catch (error) {
    return toActionError(error, "retireVehicleAction");
  }
}

// ---------------------------------------------------------------------------
// Service areas
// ---------------------------------------------------------------------------

export type ServiceAreaActionState = ActionResult<{ serviceAreaId: string }> | null;

export async function saveServiceAreaAction(
  _previous: ServiceAreaActionState,
  formData: FormData,
): Promise<ServiceAreaActionState> {
  try {
    const { user, providerId } = await requireDeliveryProvider();
    await enforceRateLimit("mutation", user.id);

    const parsed = serviceAreaSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please choose where you deliver.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }
    const input = parsed.data;

    const province = await db.province.findUnique({
      where: { id: input.provinceId },
      select: { id: true },
    });
    if (!province) {
      throw new ValidationError("Choose a province.", { provinceId: ["Select a province."] });
    }

    if (input.districtId) {
      const district = await db.district.findFirst({
        where: { id: input.districtId, provinceId: input.provinceId },
        select: { id: true },
      });
      if (!district) {
        throw new ValidationError("Choose a district in that province.", {
          districtId: ["That district is not in the province you chose."],
        });
      }
    }

    // A province-wide area has a NULL district, which a compound unique index
    // cannot match, so the existing row is found first rather than upserted.
    const existing = await db.serviceArea.findFirst({
      where: {
        providerId,
        provinceId: input.provinceId,
        districtId: input.districtId ?? null,
      },
      select: { id: true },
    });

    const area = existing
      ? await db.serviceArea.update({
          where: { id: existing.id },
          data: { feeMinor: input.feeMinor },
          select: { id: true },
        })
      : await db.serviceArea.create({
          data: {
            providerId,
            provinceId: input.provinceId,
            districtId: input.districtId ?? null,
            feeMinor: input.feeMinor,
          },
          select: { id: true },
        });

    revalidatePath("/delivery/areas");
    revalidatePath("/delivery");
    return actionSuccess({ serviceAreaId: area.id });
  } catch (error) {
    return toActionError(error, "saveServiceAreaAction");
  }
}

export async function removeServiceAreaAction(
  _previous: ServiceAreaActionState,
  formData: FormData,
): Promise<ServiceAreaActionState> {
  try {
    const { user, providerId } = await requireDeliveryProvider();
    await enforceRateLimit("mutation", user.id);

    const parsed = removeServiceAreaSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) return actionFailure("That area is not valid.", "VALIDATION_ERROR");

    const deleted = await db.serviceArea.deleteMany({
      where: { id: parsed.data.serviceAreaId, providerId },
    });
    if (deleted.count === 0) return actionFailure("That area is not yours.", "NOT_FOUND");

    revalidatePath("/delivery/areas");
    revalidatePath("/delivery");
    return actionSuccess({ serviceAreaId: parsed.data.serviceAreaId });
  } catch (error) {
    return toActionError(error, "removeServiceAreaAction");
  }
}

// ---------------------------------------------------------------------------
// Provider settings
// ---------------------------------------------------------------------------

export type ProviderSettingsActionState = ActionResult<{ providerId: string }> | null;

export async function saveProviderSettingsAction(
  _previous: ProviderSettingsActionState,
  formData: FormData,
): Promise<ProviderSettingsActionState> {
  try {
    const { user, providerId } = await requireDeliveryProvider();
    await enforceRateLimit("mutation", user.id);

    const parsed = deliveryProviderSettingsSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check your business details.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }
    const input = parsed.data;

    const before = await db.deliveryProvider.findUniqueOrThrow({
      where: { id: providerId },
      select: {
        businessName: true,
        phone: true,
        baseFeeMinor: true,
        perKilometreMinor: true,
        isAcceptingJobs: true,
      },
    });

    await db.deliveryProvider.update({
      where: { id: providerId },
      data: {
        businessName: input.businessName,
        phone: input.phone,
        description: input.description ?? null,
        baseFeeMinor: input.baseFeeMinor,
        perKilometreMinor: input.perKilometreMinor,
        isAcceptingJobs: input.isAcceptingJobs,
      },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.deliveryCreated,
      resourceType: "delivery_provider",
      resourceId: providerId,
      actorUserId: user.id,
      actorRole: user.role,
      previousValue: auditSnapshot(before, [
        "businessName",
        "phone",
        "baseFeeMinor",
        "perKilometreMinor",
        "isAcceptingJobs",
      ]),
      newValue: {
        businessName: input.businessName,
        phone: input.phone,
        baseFeeMinor: input.baseFeeMinor,
        perKilometreMinor: input.perKilometreMinor,
        isAcceptingJobs: input.isAcceptingJobs,
      },
    });

    revalidatePath("/delivery/settings");
    revalidatePath("/delivery");
    return actionSuccess({ providerId });
  } catch (error) {
    return toActionError(error, "saveProviderSettingsAction");
  }
}

/**
 * Admin override for a stuck job. Deliberately narrow: an administrator can
 * unassign so the work goes back on the board, nothing more.
 */
export async function releaseDeliveryAction(
  _previous: DeliveryActionState,
  formData: FormData,
): Promise<DeliveryActionState> {
  try {
    const user = await requireAdmin();
    const deliveryId = String(formData.get("deliveryId") ?? "");

    const delivery = await db.delivery.findUnique({
      where: { id: deliveryId },
      select: { id: true, status: true, providerId: true },
    });
    if (!delivery) return actionFailure("That delivery no longer exists.", "NOT_FOUND");

    await db.delivery.update({
      where: { id: delivery.id },
      data: {
        providerId: null,
        vehicleId: null,
        status: "REQUESTED",
        events: {
          create: {
            fromStatus: delivery.status,
            toStatus: "REQUESTED",
            note: "Returned to the job board by BuildLink support.",
            actorUserId: user.id,
          },
        },
      },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.deliveryStatusChanged,
      resourceType: "delivery",
      resourceId: delivery.id,
      actorUserId: user.id,
      actorRole: user.role,
      previousValue: { status: delivery.status, providerId: delivery.providerId },
      newValue: { status: "REQUESTED", providerId: null },
    });

    revalidatePath("/delivery");
    revalidatePath("/admin/orders");
    return actionSuccess({ status: "REQUESTED" as DeliveryStatus });
  } catch (error) {
    return toActionError(error, "releaseDeliveryAction");
  }
}