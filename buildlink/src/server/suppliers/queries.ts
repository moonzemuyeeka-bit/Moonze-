import "server-only";
import type { Prisma, ProductStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { fileUrl } from "@/lib/services/storage";
import { calculateTrustScore, type TrustScoreResult } from "@/lib/domain/trust-score";
import { TERMINAL_ORDER_STATUSES } from "@/lib/domain/order-status";
import { NotFoundError } from "@/lib/errors";

/**
 * Supplier console reads.
 *
 * Every query here is scoped by `supplierId` taken from the session, never from
 * a form or a URL, so one supplier can never read another's catalogue, orders or
 * customers.
 */

export const SUPPLIER_PRODUCTS_PAGE_SIZE = 20;

export type SupplierProductFilter = "all" | "live" | "attention" | "archived";

export type SupplierProductRow = {
  id: string;
  name: string;
  brand: string | null;
  status: ProductStatus;
  unit: string;
  priceMinor: number;
  stockQuantity: number;
  lowStockThreshold: number;
  minimumOrderQuantity: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
  categoryName: string;
  imageUrl: string | null;
  rejectionReason: string | null;
  purchaseCount: number;
  viewCount: number;
  updatedAt: Date;
};

function productFilterWhere(filter: SupplierProductFilter): Prisma.ProductWhereInput {
  switch (filter) {
    case "live":
      return { status: "ACTIVE", deletedAt: null };
    case "attention":
      // Everything the supplier has to do something about: not yet approved,
      // rejected by moderation, or approved but unsellable because stock is out.
      return {
        deletedAt: null,
        OR: [
          { status: { in: ["DRAFT", "PENDING_APPROVAL", "REJECTED"] } },
          { status: "ACTIVE", stockQuantity: { lte: 0 } },
        ],
      };
    case "archived":
      return { OR: [{ status: "ARCHIVED" }, { deletedAt: { not: null } }] };
    case "all":
      return { deletedAt: null };
  }
}

export async function listSupplierProducts(
  supplierId: string,
  options: { filter?: SupplierProductFilter; search?: string; page?: number } = {},
): Promise<{
  products: SupplierProductRow[];
  total: number;
  page: number;
  pageCount: number;
}> {
  const page = Math.max(1, options.page ?? 1);
  const filter = options.filter ?? "all";

  const where: Prisma.ProductWhereInput = {
    supplierId,
    ...productFilterWhere(filter),
  };

  if (options.search) {
    where.AND = [
      {
        OR: [
          { name: { contains: options.search, mode: "insensitive" } },
          { brand: { contains: options.search, mode: "insensitive" } },
        ],
      },
    ];
  }

  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * SUPPLIER_PRODUCTS_PAGE_SIZE,
      take: SUPPLIER_PRODUCTS_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        brand: true,
        status: true,
        unit: true,
        priceMinor: true,
        stockQuantity: true,
        lowStockThreshold: true,
        minimumOrderQuantity: true,
        rejectionReason: true,
        purchaseCount: true,
        viewCount: true,
        updatedAt: true,
        category: { select: { name: true } },
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { fileKey: true } },
      },
    }),
  ]);

  return {
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      brand: product.brand,
      status: product.status,
      unit: product.unit,
      priceMinor: product.priceMinor,
      stockQuantity: product.stockQuantity,
      lowStockThreshold: product.lowStockThreshold,
      minimumOrderQuantity: product.minimumOrderQuantity,
      isOutOfStock: product.stockQuantity <= 0,
      isLowStock: product.stockQuantity > 0 && product.stockQuantity <= product.lowStockThreshold,
      categoryName: product.category.name,
      imageUrl: fileUrl(product.images[0]?.fileKey ?? null),
      rejectionReason: product.rejectionReason,
      purchaseCount: product.purchaseCount,
      viewCount: product.viewCount,
      updatedAt: product.updatedAt,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / SUPPLIER_PRODUCTS_PAGE_SIZE)),
  };
}

export type SupplierProductDetail = Awaited<ReturnType<typeof getSupplierProduct>>;

/** One of this supplier's products, with its images and stock record. */
export async function getSupplierProduct(productId: string, supplierId: string) {
  const product = await db.product.findFirst({
    where: { id: productId, supplierId },
    select: {
      id: true,
      name: true,
      slug: true,
      brand: true,
      description: true,
      unit: true,
      priceMinor: true,
      minimumOrderQuantity: true,
      stockQuantity: true,
      lowStockThreshold: true,
      deliveryAvailable: true,
      status: true,
      rejectionReason: true,
      viewCount: true,
      purchaseCount: true,
      createdAt: true,
      updatedAt: true,
      categoryId: true,
      category: { select: { id: true, name: true } },
      images: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, fileKey: true, altText: true, sortOrder: true },
      },
      inventory: {
        select: { quantityOnHand: true, quantityReserved: true, restockedAt: true },
      },
      _count: { select: { orderItems: true } },
    },
  });

  if (!product) throw new NotFoundError("product");

  return {
    ...product,
    images: product.images.map((image) => ({ ...image, url: fileUrl(image.fileKey) })),
    orderedCount: product._count.orderItems,
  };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export type SupplierDashboard = Awaited<ReturnType<typeof getSupplierDashboard>>;

/**
 * The supplier's opening screen: what needs doing now, then how the business is
 * performing. Action first — a supplier logging in at 6am wants the orders they
 * have to confirm, not a chart.
 */
export async function getSupplierDashboard(supplierId: string) {
  const [
    profile,
    awaitingConfirmation,
    inProgress,
    unpaidCount,
    lowStock,
    pendingProducts,
    pendingContracts,
    revenue,
    documentCount,
    approvedDocumentCount,
    recentOrders,
    deliveriesToArrange,
  ] = await Promise.all([
    db.supplierProfile.findUniqueOrThrow({
      where: { id: supplierId },
      select: {
        id: true,
        businessName: true,
        slug: true,
        logoKey: true,
        verificationStatus: true,
        businessRegistrationStatus: true,
        isSuspended: true,
        suspendedReason: true,
        ratingAverageBps: true,
        ratingCount: true,
        completedOrders: true,
        cancelledOrders: true,
        totalOrders: true,
        trustScore: true,
        averageResponseMinutes: true,
        deliveryAvailable: true,
        isDemo: true,
        createdAt: true,
        province: { select: { name: true } },
        district: { select: { name: true } },
        categories: { select: { id: true, name: true } },
      },
    }),
    db.order.count({ where: { supplierId, status: { in: ["PENDING_PAYMENT", "PAYMENT_PENDING"] } } }),
    db.order.count({
      where: {
        supplierId,
        status: { in: ["CONFIRMED", "PROCESSING", "READY_FOR_DELIVERY", "OUT_FOR_DELIVERY"] },
      },
    }),
    db.payment.count({ where: { supplierId, status: { in: ["INITIATED", "PENDING"] } } }),
    db.product.count({
      where: {
        supplierId,
        deletedAt: null,
        status: "ACTIVE",
        stockQuantity: { lte: db.product.fields.lowStockThreshold },
      },
    }),
    db.product.count({
      where: { supplierId, deletedAt: null, status: { in: ["DRAFT", "PENDING_APPROVAL"] } },
    }),
    db.contract.count({ where: { supplierId, status: "SENT", createdByRole: "CUSTOMER" } }),
    db.order.aggregate({
      where: { supplierId, status: { in: ["DELIVERED", "COMPLETED"] } },
      _sum: { totalMinor: true },
      _count: { _all: true },
    }),
    db.supplierDocument.count({ where: { supplierId } }),
    db.supplierDocument.count({ where: { supplierId, reviewStatus: "APPROVED" } }),
    db.order.findMany({
      where: { supplierId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalMinor: true,
        placedAt: true,
        fulfilmentMethod: true,
        customer: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
    db.delivery.count({
      where: {
        order: { supplierId },
        method: { not: "CUSTOMER_PICKUP" },
        status: { in: ["REQUESTED", "ASSIGNED"] },
      },
    }),
  ]);

  const trust = await supplierTrust(supplierId, profile);

  return {
    profile: { ...profile, logoUrl: fileUrl(profile.logoKey) },
    trust,
    actions: {
      awaitingConfirmation,
      inProgress,
      unpaidCount,
      lowStock,
      pendingProducts,
      pendingContracts,
      deliveriesToArrange,
    },
    revenue: {
      totalMinor: revenue._sum.totalMinor ?? 0,
      orderCount: revenue._count._all,
    },
    documents: { total: documentCount, approved: approvedDocumentCount },
    recentOrders,
  };
}

type TrustInputProfile = {
  verificationStatus: Prisma.SupplierProfileGetPayload<{
    select: { verificationStatus: true };
  }>["verificationStatus"];
  ratingAverageBps: number;
  ratingCount: number;
  completedOrders: number;
  cancelledOrders: number;
  totalOrders: number;
  averageResponseMinutes: number | null;
};

/** Recomputes the live trust score, including the parts held outside the profile row. */
export async function supplierTrust(
  supplierId: string,
  profile: TrustInputProfile,
): Promise<TrustScoreResult> {
  const [deliveriesCompleted, deliveriesAttempted, openDisputes, resolvedDisputes] =
    await Promise.all([
      db.delivery.count({ where: { order: { supplierId }, status: "DELIVERED" } }),
      db.delivery.count({
        where: { order: { supplierId }, status: { in: ["DELIVERED", "FAILED"] } },
      }),
      db.dispute.count({ where: { supplierId, status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
      db.dispute.count({ where: { supplierId, status: { in: ["RESOLVED", "CLOSED"] } } }),
    ]);

  return calculateTrustScore({
    verificationStatus: profile.verificationStatus,
    ratingAverageBps: profile.ratingAverageBps,
    ratingCount: profile.ratingCount,
    completedOrders: profile.completedOrders,
    cancelledOrders: profile.cancelledOrders,
    totalOrders: profile.totalOrders,
    deliveriesCompleted,
    deliveriesAttempted,
    openDisputes,
    resolvedDisputes,
    averageResponseMinutes: profile.averageResponseMinutes,
  });
}

// ---------------------------------------------------------------------------
// Verification, documents and settings
// ---------------------------------------------------------------------------

export async function getSupplierVerification(supplierId: string) {
  const [supplier, documents, verifications] = await Promise.all([
    db.supplierProfile.findUniqueOrThrow({
      where: { id: supplierId },
      select: {
        businessName: true,
        verificationStatus: true,
        verifiedAt: true,
        businessRegistrationStatus: true,
        registrationNumber: true,
        taxpayerNumber: true,
        isSuspended: true,
        suspendedReason: true,
      },
    }),
    db.supplierDocument.findMany({
      where: { supplierId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        fileKey: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        reviewStatus: true,
        reviewNote: true,
        reviewedAt: true,
        createdAt: true,
      },
    }),
    db.supplierVerification.findMany({
      where: { supplierId },
      orderBy: { submittedAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
        decisionNote: true,
      },
    }),
  ]);

  return {
    supplier,
    documents: documents.map((document) => ({
      ...document,
      // Documents are private: the file route authorises each read.
      url: `/api/files/${document.fileKey}`,
    })),
    verifications,
  };
}

export async function getSupplierSettings(supplierId: string) {
  return db.supplierProfile.findUniqueOrThrow({
    where: { id: supplierId },
    select: {
      id: true,
      businessName: true,
      slug: true,
      description: true,
      logoKey: true,
      phone: true,
      email: true,
      address: true,
      provinceId: true,
      districtId: true,
      yearsOperating: true,
      registrationNumber: true,
      taxpayerNumber: true,
      deliveryAvailable: true,
      deliveryNotes: true,
      minimumOrderMinor: true,
      deliveryBaseFeeMinor: true,
      deliveryFreeAboveMinor: true,
      subscriptionTier: true,
      commissionRateBps: true,
      isDemo: true,
      categories: { select: { id: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Customers and analytics
// ---------------------------------------------------------------------------

export type SupplierCustomer = {
  id: string;
  name: string;
  phone: string | null;
  email: string;
  orderCount: number;
  spendMinor: number;
  lastOrderAt: Date | null;
  openOrders: number;
};

/**
 * People who have bought from this supplier, most valuable first.
 *
 * Aggregated in one grouped query rather than by loading every order, so a
 * supplier with thousands of orders still gets a fast list.
 */
export async function listSupplierCustomers(
  supplierId: string,
  limit = 50,
): Promise<SupplierCustomer[]> {
  const grouped = await db.order.groupBy({
    by: ["customerId"],
    where: { supplierId, status: { not: "DRAFT" } },
    _sum: { totalMinor: true },
    _count: { _all: true },
    _max: { placedAt: true },
    orderBy: { _sum: { totalMinor: "desc" } },
    take: limit,
  });

  if (grouped.length === 0) return [];

  const customerIds = grouped.map((row) => row.customerId);

  const [customers, openCounts] = await Promise.all([
    db.user.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true, phone: true, email: true },
    }),
    db.order.groupBy({
      by: ["customerId"],
      where: {
        supplierId,
        customerId: { in: customerIds },
        status: { notIn: [...TERMINAL_ORDER_STATUSES, "DRAFT"] },
      },
      _count: { _all: true },
    }),
  ]);

  const byId = new Map(customers.map((customer) => [customer.id, customer]));
  const openById = new Map(openCounts.map((row) => [row.customerId, row._count._all]));

  return grouped.flatMap((row) => {
    const customer = byId.get(row.customerId);
    if (!customer) return [];
    return [
      {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        orderCount: row._count._all,
        spendMinor: row._sum.totalMinor ?? 0,
        lastOrderAt: row._max.placedAt,
        openOrders: openById.get(row.customerId) ?? 0,
      },
    ];
  });
}

export type SupplierAnalytics = Awaited<ReturnType<typeof getSupplierAnalytics>>;

/**
 * Trading performance over a window, plus the catalogue facts that explain it.
 * Deliberately built from orders rather than page views: a supplier's questions
 * are "what sold and what didn't", not "what was clicked".
 */
export async function getSupplierAnalytics(supplierId: string, days = 90) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [statusCounts, monthly, topProducts, neverSold, reviewStats, fulfilment, categoryRevenue] =
    await Promise.all([
      db.order.groupBy({
        by: ["status"],
        where: { supplierId, createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { totalMinor: true },
      }),
      db.$queryRaw<Array<{ month: Date; orders: bigint; revenue_minor: bigint | null }>>`
        SELECT date_trunc('month', COALESCE(o."placedAt", o."createdAt")) AS month,
               count(*) AS orders,
               sum(o."totalMinor") FILTER (
                 WHERE o."status" IN ('DELIVERED', 'COMPLETED')
               ) AS revenue_minor
        FROM "Order" o
        WHERE o."supplierId" = ${supplierId}
          AND COALESCE(o."placedAt", o."createdAt") >= ${since}
          AND o."status" <> 'DRAFT'
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      db.orderItem.groupBy({
        by: ["productName"],
        where: {
          order: { supplierId, status: { in: ["DELIVERED", "COMPLETED"] }, createdAt: { gte: since } },
        },
        _sum: { quantity: true, lineTotalMinor: true },
        orderBy: { _sum: { lineTotalMinor: "desc" } },
        take: 8,
      }),
      db.product.findMany({
        where: {
          supplierId,
          deletedAt: null,
          status: "ACTIVE",
          purchaseCount: 0,
        },
        orderBy: { viewCount: "desc" },
        take: 8,
        select: { id: true, name: true, priceMinor: true, unit: true, viewCount: true },
      }),
      db.review.aggregate({
        where: { supplierId, status: "PUBLISHED" },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      db.order.groupBy({
        by: ["fulfilmentMethod"],
        where: { supplierId, status: { not: "DRAFT" }, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      db.$queryRaw<Array<{ category: string; revenue_minor: bigint | null }>>`
        SELECT c."name" AS category,
               sum(oi."lineTotalMinor") AS revenue_minor
        FROM "OrderItem" oi
        JOIN "Order" o ON o."id" = oi."orderId"
        LEFT JOIN "Product" p ON p."id" = oi."productId"
        LEFT JOIN "ProductCategory" c ON c."id" = p."categoryId"
        WHERE o."supplierId" = ${supplierId}
          AND o."status" IN ('DELIVERED', 'COMPLETED')
          AND o."createdAt" >= ${since}
          AND c."name" IS NOT NULL
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 6
      `,
    ]);

  const ordered = statusCounts.reduce((total, row) => total + row._count._all, 0);
  const completed = statusCounts
    .filter((row) => row.status === "COMPLETED" || row.status === "DELIVERED")
    .reduce((total, row) => total + row._count._all, 0);
  const cancelled = statusCounts
    .filter((row) => row.status === "CANCELLED")
    .reduce((total, row) => total + row._count._all, 0);
  const revenueMinor = statusCounts
    .filter((row) => row.status === "COMPLETED" || row.status === "DELIVERED")
    .reduce((total, row) => total + (row._sum.totalMinor ?? 0), 0);

  return {
    windowDays: days,
    orders: { total: ordered, completed, cancelled },
    revenueMinor,
    averageOrderMinor: completed === 0 ? 0 : Math.round(revenueMinor / completed),
    monthly: monthly.map((row) => ({
      month: row.month,
      orders: Number(row.orders),
      revenueMinor: Number(row.revenue_minor ?? 0),
    })),
    topProducts: topProducts.map((row) => ({
      name: row.productName,
      quantity: row._sum.quantity ?? 0,
      revenueMinor: row._sum.lineTotalMinor ?? 0,
    })),
    neverSold,
    rating: {
      average: reviewStats._avg.rating ?? 0,
      count: reviewStats._count._all,
    },
    fulfilment: fulfilment.map((row) => ({
      method: row.fulfilmentMethod,
      count: row._count._all,
    })),
    categoryRevenue: categoryRevenue.map((row) => ({
      category: row.category,
      revenueMinor: Number(row.revenue_minor ?? 0),
    })),
  };
}

/** Deliveries this supplier still has to hand to somebody. */
export async function listDeliveriesToArrange(supplierId: string) {
  return db.delivery.findMany({
    where: {
      order: { supplierId },
      method: { not: "CUSTOMER_PICKUP" },
      status: { in: ["REQUESTED", "ASSIGNED"] },
    },
    orderBy: { createdAt: "asc" },
    take: 25,
    select: {
      id: true,
      method: true,
      status: true,
      addressLine: true,
      scheduledFor: true,
      feeMinor: true,
      province: { select: { name: true } },
      district: { select: { name: true } },
      provider: { select: { businessName: true } },
      order: { select: { id: true, orderNumber: true, status: true } },
    },
  });
}
