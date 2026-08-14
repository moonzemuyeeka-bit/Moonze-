import "server-only";
import type { DeliveryStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/permissions";
import { buildDeliveryTimeline } from "@/lib/domain/delivery-status";
import { fileUrl } from "@/lib/services/storage";
import { NotFoundError } from "@/lib/errors";

/**
 * Delivery reads.
 *
 * The transporter's list and the job board are the same query with a different
 * `where`: a job board shows unclaimed work inside the areas this transporter
 * serves, and "my deliveries" shows work already theirs.
 */

const ACTIVE_JOB_STATUSES: readonly DeliveryStatus[] = [
  "ASSIGNED",
  "ACCEPTED",
  "PICKED_UP",
  "IN_TRANSIT",
];

export type DeliveryJob = {
  id: string;
  orderId: string;
  orderNumber: string;
  status: DeliveryStatus;
  feeMinor: number;
  addressLine: string;
  locationDetail: string | null;
  provinceName: string;
  districtName: string | null;
  contactName: string;
  contactPhone: string;
  supplierName: string;
  supplierAddress: string | null;
  supplierPhone: string;
  itemCount: number;
  totalMinor: number;
  scheduledFor: Date | null;
  createdAt: Date;
  vehicleLabel: string | null;
};

function jobSelect() {
  return {
    id: true,
    status: true,
    feeMinor: true,
    addressLine: true,
    locationDetail: true,
    contactName: true,
    contactPhone: true,
    scheduledFor: true,
    createdAt: true,
    province: { select: { name: true } },
    district: { select: { name: true } },
    vehicle: { select: { type: true, registration: true } },
    order: {
      select: {
        id: true,
        orderNumber: true,
        totalMinor: true,
        supplier: { select: { businessName: true, address: true, phone: true } },
        _count: { select: { items: true } },
      },
    },
  } satisfies Prisma.DeliverySelect;
}

type JobRow = Prisma.DeliveryGetPayload<{ select: ReturnType<typeof jobSelect> }>;

function toJob(delivery: JobRow): DeliveryJob {
  return {
    id: delivery.id,
    orderId: delivery.order.id,
    orderNumber: delivery.order.orderNumber,
    status: delivery.status,
    feeMinor: delivery.feeMinor,
    addressLine: delivery.addressLine,
    locationDetail: delivery.locationDetail,
    provinceName: delivery.province.name,
    districtName: delivery.district?.name ?? null,
    contactName: delivery.contactName,
    contactPhone: delivery.contactPhone,
    supplierName: delivery.order.supplier.businessName,
    supplierAddress: delivery.order.supplier.address,
    supplierPhone: delivery.order.supplier.phone,
    itemCount: delivery.order._count.items,
    totalMinor: delivery.order.totalMinor,
    scheduledFor: delivery.scheduledFor,
    createdAt: delivery.createdAt,
    vehicleLabel: delivery.vehicle
      ? `${delivery.vehicle.type} · ${delivery.vehicle.registration}`
      : null,
  };
}

/**
 * Jobs a transporter can claim: third-party deliveries with nobody on them yet,
 * for orders the supplier has confirmed, inside the provinces (and districts)
 * this transporter serves.
 */
export async function listAvailableJobs(providerId: string): Promise<DeliveryJob[]> {
  const areas = await db.serviceArea.findMany({
    where: { providerId },
    select: { provinceId: true, districtId: true },
  });
  if (areas.length === 0) return [];

  const deliveries = await db.delivery.findMany({
    where: {
      providerId: null,
      method: "THIRD_PARTY_DELIVERY",
      status: "REQUESTED",
      order: { status: { in: ["CONFIRMED", "PROCESSING", "READY_FOR_DELIVERY"] } },
      OR: areas.map((area) =>
        area.districtId
          ? { provinceId: area.provinceId, districtId: area.districtId }
          : { provinceId: area.provinceId },
      ),
    },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: jobSelect(),
  });

  return deliveries.map(toJob);
}

export async function listProviderDeliveries(
  providerId: string,
  options: { scope?: "active" | "history" } = {},
): Promise<DeliveryJob[]> {
  const deliveries = await db.delivery.findMany({
    where: {
      providerId,
      status:
        options.scope === "history"
          ? { in: ["DELIVERED", "FAILED", "CANCELLED"] }
          : { in: [...ACTIVE_JOB_STATUSES] },
    },
    orderBy: options.scope === "history" ? { updatedAt: "desc" } : { createdAt: "asc" },
    take: 100,
    select: jobSelect(),
  });

  return deliveries.map(toJob);
}

export type DeliveryDetail = Awaited<ReturnType<typeof getDeliveryDetail>>;

/** Everything one delivery page renders, for whichever party is looking. */
export async function getDeliveryDetail(deliveryId: string, user: SessionUser) {
  const delivery = await db.delivery.findUnique({
    where: { id: deliveryId },
    select: {
      id: true,
      method: true,
      status: true,
      addressLine: true,
      locationDetail: true,
      contactName: true,
      contactPhone: true,
      instructions: true,
      feeMinor: true,
      scheduledFor: true,
      pickedUpAt: true,
      deliveredAt: true,
      failureReason: true,
      proofFileKey: true,
      receivedBy: true,
      providerId: true,
      createdAt: true,
      province: { select: { name: true } },
      district: { select: { name: true } },
      provider: { select: { id: true, userId: true, businessName: true, phone: true } },
      vehicle: { select: { id: true, type: true, registration: true } },
      events: {
        orderBy: { createdAt: "asc" },
        select: { id: true, toStatus: true, note: true, createdAt: true },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalMinor: true,
          customerId: true,
          customer: { select: { name: true, phone: true } },
          supplierId: true,
          supplier: {
            select: {
              userId: true,
              businessName: true,
              phone: true,
              address: true,
              province: { select: { name: true } },
              district: { select: { name: true } },
            },
          },
          items: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              productName: true,
              unit: true,
              quantity: true,
            },
          },
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
    ...delivery,
    viewer: { isCustomer, isSupplier, isProvider, isAdmin },
    timeline: buildDeliveryTimeline({
      method: delivery.method,
      status: delivery.status,
      events: delivery.events,
    }),
    proofUrl: fileUrl(delivery.proofFileKey),
  };
}

// ---------------------------------------------------------------------------
// Provider profile, fleet and areas
// ---------------------------------------------------------------------------

export async function getProviderProfile(providerId: string) {
  const provider = await db.deliveryProvider.findUnique({
    where: { id: providerId },
    select: {
      id: true,
      businessName: true,
      type: true,
      phone: true,
      description: true,
      baseFeeMinor: true,
      perKilometreMinor: true,
      verificationStatus: true,
      isAcceptingJobs: true,
      ratingAverageBps: true,
      ratingCount: true,
      completedDeliveries: true,
      createdAt: true,
    },
  });
  if (!provider) throw new NotFoundError("delivery provider");
  return provider;
}

export async function listVehicles(providerId: string) {
  return db.vehicle.findMany({
    where: { providerId },
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      type: true,
      registration: true,
      description: true,
      capacityKg: true,
      capacityCubicMetres: true,
      isActive: true,
      _count: { select: { deliveries: true } },
    },
  });
}

export async function listServiceAreas(providerId: string) {
  return db.serviceArea.findMany({
    where: { providerId },
    orderBy: [{ province: { name: "asc" } }, { district: { name: "asc" } }],
    select: {
      id: true,
      feeMinor: true,
      province: { select: { id: true, name: true } },
      district: { select: { id: true, name: true } },
    },
  });
}

/** Headline counts for the transporter's dashboard. */
export async function countProviderJobs(providerId: string): Promise<{
  available: number;
  active: number;
  completed: number;
}> {
  const [available, active, completed] = await Promise.all([
    listAvailableJobs(providerId).then((jobs) => jobs.length),
    db.delivery.count({ where: { providerId, status: { in: [...ACTIVE_JOB_STATUSES] } } }),
    db.delivery.count({ where: { providerId, status: "DELIVERED" } }),
  ]);
  return { available, active, completed };
}

/**
 * Transporters a supplier can hand a delivery to: verified, accepting work and
 * covering the delivery's destination.
 */
export async function listProvidersForDelivery(input: {
  provinceId: string;
  districtId: string | null;
}) {
  return db.deliveryProvider.findMany({
    where: {
      deletedAt: null,
      isAcceptingJobs: true,
      verificationStatus: { in: ["VERIFIED", "PENDING"] },
      serviceAreas: {
        some: {
          provinceId: input.provinceId,
          ...(input.districtId ? { OR: [{ districtId: input.districtId }, { districtId: null }] } : {}),
        },
      },
    },
    orderBy: [{ verificationStatus: "asc" }, { ratingAverageBps: "desc" }],
    take: 25,
    select: {
      id: true,
      businessName: true,
      type: true,
      phone: true,
      baseFeeMinor: true,
      perKilometreMinor: true,
      verificationStatus: true,
      ratingAverageBps: true,
      ratingCount: true,
      completedDeliveries: true,
      isDemo: true,
      vehicles: {
        where: { isActive: true },
        select: { id: true, type: true, registration: true },
      },
      serviceAreas: {
        where: { provinceId: input.provinceId },
        select: { feeMinor: true, districtId: true },
      },
    },
  });
}
