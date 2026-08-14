import "server-only";
import type { DeliveryMethod, DeliveryStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/permissions";
import {
  assertDeliveryTransition,
  orderStatusForDelivery,
} from "@/lib/domain/delivery-status";
import { canTransitionOrder } from "@/lib/domain/order-status";
import { applyOrderStatus } from "@/server/orders/service";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { notify } from "@/lib/services/notifications";
import { DELIVERY_STATUS_LABELS } from "@/lib/labels";
import { NotFoundError } from "@/lib/errors";

/**
 * Delivery services.
 *
 * A delivery has three interested parties — the customer waiting on site, the
 * supplier whose goods they are, and the transporter carrying them — so every
 * status change has to notify the two who did not make it and keep the order in
 * step. Doing that in one place is the only way it stays consistent.
 */

export type DeliveryForActor = {
  id: string;
  orderId: string;
  orderNumber: string;
  status: DeliveryStatus;
  method: DeliveryMethod;
  feeMinor: number;
  providerId: string | null;
  providerUserId: string | null;
  customerId: string;
  customerName: string;
  supplierId: string;
  supplierUserId: string;
  supplierName: string;
  proofFileKey: string | null;
  /** How this actor relates to the delivery. */
  viewer: {
    isCustomer: boolean;
    isSupplier: boolean;
    isProvider: boolean;
    isAdmin: boolean;
  };
};

export async function loadDeliveryForActor(
  deliveryId: string,
  user: SessionUser,
): Promise<DeliveryForActor> {
  const delivery = await db.delivery.findUnique({
    where: { id: deliveryId },
    select: {
      id: true,
      status: true,
      method: true,
      feeMinor: true,
      providerId: true,
      proofFileKey: true,
      provider: { select: { userId: true } },
      order: {
        select: {
          id: true,
          orderNumber: true,
          customerId: true,
          customer: { select: { name: true } },
          supplierId: true,
          supplier: { select: { userId: true, businessName: true } },
        },
      },
    },
  });

  if (!delivery) throw new NotFoundError("delivery");

  const isCustomer = delivery.order.customerId === user.id;
  const isSupplier = delivery.order.supplier.userId === user.id;
  const isProvider = delivery.provider?.userId === user.id;
  const isAdmin = isAdminRole(user.role);
  if (!isCustomer && !isSupplier && !isProvider && !isAdmin) {
    throw new NotFoundError("delivery");
  }

  return {
    id: delivery.id,
    orderId: delivery.order.id,
    orderNumber: delivery.order.orderNumber,
    status: delivery.status,
    method: delivery.method,
    feeMinor: delivery.feeMinor,
    providerId: delivery.providerId,
    providerUserId: delivery.provider?.userId ?? null,
    customerId: delivery.order.customerId,
    customerName: delivery.order.customer.name,
    supplierId: delivery.order.supplierId,
    supplierUserId: delivery.order.supplier.userId,
    supplierName: delivery.order.supplier.businessName,
    proofFileKey: delivery.proofFileKey,
    viewer: { isCustomer, isSupplier, isProvider, isAdmin },
  };
}

/**
 * What a transporter charges to reach a delivery's destination, taken from the
 * service area they published. A district-specific area wins over a
 * province-wide one; `null` means they publish no rate for that destination and
 * the fee already on the delivery stands.
 */
export async function quoteServiceAreaFee(
  providerId: string,
  deliveryId: string,
): Promise<number | null> {
  const delivery = await db.delivery.findUnique({
    where: { id: deliveryId },
    select: { provinceId: true, districtId: true },
  });
  if (!delivery) return null;

  const areas = await db.serviceArea.findMany({
    where: {
      providerId,
      provinceId: delivery.provinceId,
      OR: [{ districtId: delivery.districtId }, { districtId: null }],
    },
    select: { districtId: true, feeMinor: true },
  });
  if (areas.length === 0) return null;

  const exact = areas.find((area) => area.districtId !== null);
  return (exact ?? areas[0])?.feeMinor ?? null;
}

export type ApplyDeliveryStatusInput = {
  delivery: DeliveryForActor;
  to: DeliveryStatus;
  actor: SessionUser;
  note?: string | null;
  failureReason?: string | null;
  receivedBy?: string | null;
  proofFileKey?: string | null;
};

/**
 * The single path through which a delivery status changes.
 *
 * Appends the event, stamps the matching timestamp, moves the order along if the
 * delivery status implies it, writes the audit entry and notifies the other
 * parties. Legality is checked here; who is allowed to make the move is the
 * caller's decision.
 */
export async function applyDeliveryStatus(input: ApplyDeliveryStatusInput): Promise<void> {
  const { delivery, to, actor } = input;
  assertDeliveryTransition(delivery.status, to);

  const now = new Date();

  await db.$transaction(async (tx) => {
    const data: Prisma.DeliveryUpdateInput = {
      status: to,
      events: {
        create: {
          fromStatus: delivery.status,
          toStatus: to,
          note: input.note ?? input.failureReason ?? null,
          actorUserId: actor.id,
        },
      },
    };

    if (to === "PICKED_UP") data.pickedUpAt = now;
    if (to === "DELIVERED") {
      data.deliveredAt = now;
      data.failureReason = null;
      if (input.receivedBy) data.receivedBy = input.receivedBy;
      if (input.proofFileKey) data.proofFileKey = input.proofFileKey;
    }
    if (to === "FAILED") data.failureReason = input.failureReason ?? input.note ?? null;

    await tx.delivery.update({ where: { id: delivery.id }, data });

    if (to === "DELIVERED" && delivery.providerId) {
      await tx.deliveryProvider.update({
        where: { id: delivery.providerId },
        data: { completedDeliveries: { increment: 1 } },
      });
    }

    await recordAudit(
      {
        action: AUDIT_ACTIONS.deliveryStatusChanged,
        resourceType: "delivery",
        resourceId: delivery.id,
        actorUserId: actor.id,
        actorRole: actor.role,
        previousValue: { status: delivery.status },
        newValue: { status: to, note: input.note ?? null },
      },
      tx,
    );
  });

  await syncOrderWithDelivery({ delivery, to, actor, note: input.note ?? null });
  await notifyDeliveryOutcome(input);
}

/**
 * Moves the order to match the delivery. `OUT_FOR_DELIVERY` and `DELIVERED` are
 * facts about the order too, and a customer should not have to read the delivery
 * card to learn them.
 */
async function syncOrderWithDelivery(input: {
  delivery: DeliveryForActor;
  to: DeliveryStatus;
  actor: SessionUser;
  note: string | null;
}): Promise<void> {
  const target = orderStatusForDelivery(input.to);
  if (!target) return;

  const order = await db.order.findUnique({
    where: { id: input.delivery.orderId },
    select: { status: true },
  });
  if (!order || !canTransitionOrder(order.status, target)) return;

  await applyOrderStatus({
    orderId: input.delivery.orderId,
    from: order.status,
    to: target,
    note: input.note ?? `Delivery is now "${DELIVERY_STATUS_LABELS[input.to]}".`,
    actor: input.actor,
  });
}

async function notifyDeliveryOutcome(input: ApplyDeliveryStatusInput): Promise<void> {
  const { delivery, to, actor } = input;
  const label = DELIVERY_STATUS_LABELS[to];

  const audience = new Map<string, string>([
    [delivery.customerId, `/orders/${delivery.orderId}`],
    [delivery.supplierUserId, `/supplier/orders/${delivery.orderId}`],
  ]);
  if (delivery.providerUserId) {
    audience.set(delivery.providerUserId, `/delivery/assigned/${delivery.id}`);
  }
  audience.delete(actor.id);

  const type =
    to === "DELIVERED"
      ? "DELIVERY_COMPLETED"
      : to === "PICKED_UP" || to === "IN_TRANSIT"
        ? "DELIVERY_DISPATCHED"
        : "DELIVERY_SCHEDULED";

  for (const [userId, linkUrl] of audience) {
    await notify({
      userId,
      type,
      title: `Order ${delivery.orderNumber}: ${label.toLowerCase()}`,
      body:
        input.note ??
        input.failureReason ??
        (to === "DELIVERED"
          ? `The materials were received${input.receivedBy ? ` by ${input.receivedBy}` : ""}.`
          : `The delivery for order ${delivery.orderNumber} is now "${label}".`),
      linkUrl,
    });
  }
}

/**
 * Assigns a transporter (and optionally a vehicle) to a delivery.
 *
 * Kept separate from `applyDeliveryStatus` because assignment changes *who* the
 * job belongs to, which needs its own audit entry and its own notification to
 * the transporter who has just been given work.
 */
export async function assignDelivery(input: {
  delivery: DeliveryForActor;
  providerId: string;
  vehicleId: string | null;
  feeMinor: number | null;
  scheduledFor: Date | null;
  note: string | null;
  actor: SessionUser;
}): Promise<void> {
  assertDeliveryTransition(input.delivery.status, "ASSIGNED");

  const provider = await db.deliveryProvider.findFirst({
    where: { id: input.providerId, deletedAt: null },
    select: { id: true, userId: true, businessName: true },
  });
  if (!provider) throw new NotFoundError("delivery provider");

  await db.$transaction(async (tx) => {
    await tx.delivery.update({
      where: { id: input.delivery.id },
      data: {
        status: "ASSIGNED",
        providerId: provider.id,
        vehicleId: input.vehicleId,
        scheduledFor: input.scheduledFor,
        ...(input.feeMinor === null ? {} : { feeMinor: input.feeMinor }),
        events: {
          create: {
            fromStatus: input.delivery.status,
            toStatus: "ASSIGNED",
            note: input.note ?? `Assigned to ${provider.businessName}.`,
            actorUserId: input.actor.id,
          },
        },
      },
    });

    await recordAudit(
      {
        action: AUDIT_ACTIONS.deliveryAssigned,
        resourceType: "delivery",
        resourceId: input.delivery.id,
        actorUserId: input.actor.id,
        actorRole: input.actor.role,
        previousValue: { providerId: input.delivery.providerId, status: input.delivery.status },
        newValue: { providerId: provider.id, vehicleId: input.vehicleId, status: "ASSIGNED" },
      },
      tx,
    );
  });

  await notify({
    userId: provider.userId,
    type: "DELIVERY_SCHEDULED",
    title: `New delivery job for order ${input.delivery.orderNumber}`,
    body: `${input.delivery.supplierName} has assigned you a delivery. Accept it to confirm you can carry it.`,
    linkUrl: `/delivery/assigned/${input.delivery.id}`,
  });

  await notify({
    userId: input.delivery.customerId,
    type: "DELIVERY_SCHEDULED",
    title: `A transporter is assigned to order ${input.delivery.orderNumber}`,
    body: `${provider.businessName} will bring your materials.`,
    linkUrl: `/orders/${input.delivery.orderId}`,
  });
}
