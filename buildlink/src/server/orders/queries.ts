import "server-only";
import type { OrderStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/permissions";
import { NotFoundError } from "@/lib/errors";
import { buildOrderTimeline, TERMINAL_ORDER_STATUSES } from "@/lib/domain/order-status";
import { buildDeliveryTimeline } from "@/lib/domain/delivery-status";
import { summarisePayments } from "@/lib/domain/payment-status";
import { fileUrl } from "@/lib/services/storage";

/**
 * Order reads.
 *
 * The party is always part of the `where` clause rather than checked afterwards,
 * so a guessed order id answers "not found" instead of leaking whether it
 * exists. `audience` decides whose orders are in scope; an administrator sees
 * everything, which the audit log records.
 */

export type OrderAudience =
  | { kind: "customer"; userId: string }
  | { kind: "supplier"; supplierId: string }
  | { kind: "admin" };

export function audienceFor(user: SessionUser): OrderAudience {
  return isAdminRole(user.role) ? { kind: "admin" } : { kind: "customer", userId: user.id };
}

function audienceWhere(audience: OrderAudience): Prisma.OrderWhereInput {
  switch (audience.kind) {
    case "customer":
      return { customerId: audience.userId };
    case "supplier":
      return { supplierId: audience.supplierId };
    case "admin":
      return {};
  }
}

export type OrderListItem = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalMinor: number;
  itemCount: number;
  placedAt: Date | null;
  fulfilmentMethod: string;
  supplierName: string;
  supplierSlug: string;
  customerName: string;
  projectName: string | null;
  deliveryStatus: string | null;
  outstandingMinor: number;
  isClosed: boolean;
  hasReview: boolean;
};

export type OrderListResult = {
  orders: OrderListItem[];
  total: number;
  page: number;
  pageCount: number;
};

export const ORDERS_PAGE_SIZE = 12;

export async function listOrders(
  audience: OrderAudience,
  options: { status?: OrderStatus | "OPEN" | "CLOSED"; page?: number; search?: string } = {},
): Promise<OrderListResult> {
  const page = Math.max(1, options.page ?? 1);

  const where: Prisma.OrderWhereInput = { ...audienceWhere(audience) };

  if (options.status === "OPEN") {
    where.status = { notIn: [...TERMINAL_ORDER_STATUSES] };
  } else if (options.status === "CLOSED") {
    where.status = { in: [...TERMINAL_ORDER_STATUSES] };
  } else if (options.status) {
    where.status = options.status;
  }

  if (options.search) {
    where.OR = [
      { orderNumber: { contains: options.search, mode: "insensitive" } },
      { supplier: { businessName: { contains: options.search, mode: "insensitive" } } },
      { customer: { name: { contains: options.search, mode: "insensitive" } } },
    ];
  }

  const [total, orders] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ORDERS_PAGE_SIZE,
      take: ORDERS_PAGE_SIZE,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalMinor: true,
        placedAt: true,
        fulfilmentMethod: true,
        supplier: { select: { businessName: true, slug: true } },
        customer: { select: { name: true } },
        project: { select: { name: true } },
        delivery: { select: { status: true } },
        payments: { select: { status: true, amountMinor: true } },
        review: { select: { id: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);

  return {
    orders: orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalMinor: order.totalMinor,
      itemCount: order._count.items,
      placedAt: order.placedAt,
      fulfilmentMethod: order.fulfilmentMethod,
      supplierName: order.supplier.businessName,
      supplierSlug: order.supplier.slug,
      customerName: order.customer.name,
      projectName: order.project?.name ?? null,
      deliveryStatus: order.delivery?.status ?? null,
      outstandingMinor: summarisePayments(order.payments, order.totalMinor).outstandingMinor,
      isClosed: TERMINAL_ORDER_STATUSES.includes(order.status),
      hasReview: order.review !== null,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE)),
  };
}

export type OrderDetail = Awaited<ReturnType<typeof getOrderDetail>>;

/**
 * Everything one order page renders: items, money, timeline, payments, the
 * agreement and the delivery, in a single query.
 */
export async function getOrderDetail(orderId: string, user: SessionUser) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      subtotalMinor: true,
      deliveryFeeMinor: true,
      totalMinor: true,
      commissionRateBps: true,
      commissionMinor: true,
      fulfilmentMethod: true,
      customerNote: true,
      supplierNote: true,
      cancellationReason: true,
      placedAt: true,
      confirmedAt: true,
      completedAt: true,
      cancelledAt: true,
      createdAt: true,
      customerId: true,
      supplierId: true,
      projectId: true,
      customer: { select: { id: true, name: true, email: true, phone: true } },
      supplier: {
        select: {
          id: true,
          userId: true,
          businessName: true,
          slug: true,
          phone: true,
          email: true,
          verificationStatus: true,
          isDemo: true,
          province: { select: { name: true } },
          district: { select: { name: true } },
        },
      },
      project: { select: { id: true, name: true } },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          productId: true,
          productName: true,
          brand: true,
          unit: true,
          unitPriceMinor: true,
          quantity: true,
          lineTotalMinor: true,
          product: {
            select: { images: { orderBy: { sortOrder: "asc" }, take: 1, select: { fileKey: true } } },
          },
        },
      },
      events: {
        orderBy: { createdAt: "asc" },
        select: { id: true, fromStatus: true, toStatus: true, note: true, createdAt: true, actorRole: true },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          reference: true,
          method: true,
          status: true,
          amountMinor: true,
          provider: true,
          providerReference: true,
          failureReason: true,
          confirmedAt: true,
          createdAt: true,
          transactions: {
            orderBy: { occurredAt: "asc" },
            select: { id: true, fromStatus: true, toStatus: true, occurredAt: true, metadata: true },
          },
        },
      },
      contract: {
        select: {
          id: true,
          contractNumber: true,
          status: true,
          createdByRole: true,
          totalMinor: true,
          depositMinor: true,
        },
      },
      delivery: {
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
          province: { select: { name: true } },
          district: { select: { name: true } },
          provider: { select: { id: true, businessName: true, phone: true } },
          vehicle: { select: { type: true, registration: true } },
          events: {
            orderBy: { createdAt: "asc" },
            select: { id: true, toStatus: true, note: true, createdAt: true },
          },
        },
      },
      review: { select: { id: true, rating: true, comment: true, createdAt: true } },
      dispute: {
        select: {
          id: true,
          status: true,
          reason: true,
          description: true,
          resolution: true,
          resolvedAt: true,
          createdAt: true,
          raisedById: true,
        },
      },
    },
  });

  if (!order) throw new NotFoundError("order");

  const isCustomer = order.customerId === user.id;
  const isSupplier = order.supplier.userId === user.id;
  if (!isCustomer && !isSupplier && !isAdminRole(user.role)) throw new NotFoundError("order");

  const payments = summarisePayments(order.payments, order.totalMinor);

  return {
    ...order,
    viewer: {
      isCustomer,
      isSupplier,
      isAdmin: isAdminRole(user.role),
    },
    items: order.items.map((item) => ({
      ...item,
      imageUrl: fileUrl(item.product?.images[0]?.fileKey ?? null),
    })),
    timeline: buildOrderTimeline({
      status: order.status,
      fulfilmentMethod: order.fulfilmentMethod,
      events: order.events,
    }),
    deliveryTimeline: order.delivery
      ? buildDeliveryTimeline({
          method: order.delivery.method,
          status: order.delivery.status,
          events: order.delivery.events,
        })
      : [],
    paymentSummary: payments,
    proofUrl: fileUrl(order.delivery?.proofFileKey ?? null),
    isClosed: TERMINAL_ORDER_STATUSES.includes(order.status),
  };
}

/** Counts for the supplier console and admin dashboard tiles. */
export async function countOrdersByStatus(
  audience: OrderAudience,
): Promise<Record<string, number>> {
  const rows = await db.order.groupBy({
    by: ["status"],
    where: audienceWhere(audience),
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
}
