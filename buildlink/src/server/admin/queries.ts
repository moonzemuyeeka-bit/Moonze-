import "server-only";
import type {
  DisputeStatus,
  PaymentStatus,
  Prisma,
  ProductStatus,
  ReviewStatus,
  UserRole,
  UserStatus,
  VerificationStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import { fileUrl } from "@/lib/services/storage";
import { NotFoundError } from "@/lib/errors";
import { TERMINAL_ORDER_STATUSES } from "@/lib/domain/order-status";
import { calculateTrustScore } from "@/lib/domain/trust-score";

/**
 * Administration reads.
 *
 * The admin console is unscoped by design — that is what makes it an admin
 * console — so the guard is at the entrance (`requirePageAdmin`) and every write
 * writes an audit row. These queries do the counting the console needs in as few
 * round trips as possible: an admin refreshing a moderation queue every few
 * minutes should not be the heaviest reader on the database.
 */

export const ADMIN_PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export type AdminDashboard = Awaited<ReturnType<typeof getAdminDashboard>>;

export async function getAdminDashboard() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    users,
    newUsersThisWeek,
    suppliers,
    pendingVerifications,
    pendingDocuments,
    pendingProducts,
    liveProducts,
    openOrders,
    ordersThisMonth,
    gmvAllTime,
    gmvThisMonth,
    commissionThisMonth,
    openDisputes,
    unconfirmedPayments,
    contractsAwaiting,
    recentAudit,
  ] = await Promise.all([
    db.user.count({ where: { deletedAt: null } }),
    db.user.count({ where: { deletedAt: null, createdAt: { gte: weekStart } } }),
    db.supplierProfile.count({ where: { deletedAt: null } }),
    db.supplierProfile.count({ where: { deletedAt: null, verificationStatus: "PENDING" } }),
    db.supplierDocument.count({ where: { reviewStatus: "PENDING" } }),
    db.product.count({ where: { deletedAt: null, status: "PENDING_APPROVAL" } }),
    db.product.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    db.order.count({ where: { status: { notIn: [...TERMINAL_ORDER_STATUSES, "DRAFT"] } } }),
    db.order.count({ where: { status: { not: "DRAFT" }, createdAt: { gte: monthStart } } }),
    db.order.aggregate({
      where: { status: { in: ["DELIVERED", "COMPLETED"] } },
      _sum: { totalMinor: true },
    }),
    db.order.aggregate({
      where: { status: { in: ["DELIVERED", "COMPLETED"] }, createdAt: { gte: monthStart } },
      _sum: { totalMinor: true },
    }),
    db.order.aggregate({
      where: { status: { in: ["DELIVERED", "COMPLETED"] }, createdAt: { gte: monthStart } },
      _sum: { commissionMinor: true },
    }),
    db.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
    db.payment.count({ where: { status: { in: ["INITIATED", "PENDING"] } } }),
    db.contract.count({ where: { status: "SENT" } }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        action: true,
        resourceType: true,
        resourceId: true,
        createdAt: true,
        actorRole: true,
        actor: { select: { name: true } },
      },
    }),
  ]);

  return {
    users: { total: users, newThisWeek: newUsersThisWeek },
    suppliers: { total: suppliers, pendingVerification: pendingVerifications },
    queues: {
      pendingVerifications,
      pendingDocuments,
      pendingProducts,
      openDisputes,
      unconfirmedPayments,
      contractsAwaiting,
    },
    catalogue: { liveProducts },
    orders: { open: openOrders, thisMonth: ordersThisMonth },
    money: {
      gmvAllTimeMinor: gmvAllTime._sum.totalMinor ?? 0,
      gmvThisMonthMinor: gmvThisMonth._sum.totalMinor ?? 0,
      commissionThisMonthMinor: commissionThisMonth._sum.commissionMinor ?? 0,
    },
    recentAudit,
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  lastLoginAt: Date | null;
  orderCount: number;
  supplierName: string | null;
};

export async function listUsers(
  options: {
    role?: UserRole;
    status?: UserStatus;
    search?: string;
    page?: number;
  } = {},
): Promise<{ users: AdminUserRow[]; total: number; page: number; pageCount: number }> {
  const page = Math.max(1, options.page ?? 1);
  const where: Prisma.UserWhereInput = { deletedAt: null };

  if (options.role) where.role = options.role;
  if (options.status) where.status = options.status;
  if (options.search) {
    where.OR = [
      { name: { contains: options.search, mode: "insensitive" } },
      { email: { contains: options.search, mode: "insensitive" } },
      { phone: { contains: options.search } },
    ];
  }

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        supplierProfile: { select: { businessName: true } },
        _count: { select: { orders: true } },
      },
    }),
  ]);

  return {
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      orderCount: user._count.orders,
      supplierName: user.supplierProfile?.businessName ?? null,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
  };
}

export async function getUserForAdmin(userId: string) {
  const user = await db.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      phoneVerifiedAt: true,
      emailVerifiedAt: true,
      role: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      failedLogins: true,
      lockedUntil: true,
      customerProfile: {
        select: {
          onboardingCompletedAt: true,
          province: { select: { name: true } },
          district: { select: { name: true } },
        },
      },
      supplierProfile: {
        select: { id: true, businessName: true, slug: true, verificationStatus: true },
      },
      deliveryProvider: { select: { id: true, businessName: true } },
      _count: { select: { orders: true, projects: true, reviews: true, sessions: true } },
      orders: {
        where: { status: { not: "DRAFT" } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalMinor: true,
          createdAt: true,
          supplier: { select: { businessName: true } },
        },
      },
    },
  });

  if (!user) throw new NotFoundError("user");

  const [spend, audit] = await Promise.all([
    db.order.aggregate({
      where: { customerId: user.id, status: { in: ["DELIVERED", "COMPLETED"] } },
      _sum: { totalMinor: true },
    }),
    db.auditLog.findMany({
      where: { OR: [{ actorUserId: user.id }, { resourceType: "user", resourceId: user.id }] },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        action: true,
        createdAt: true,
        newValue: true,
        actor: { select: { name: true } },
      },
    }),
  ]);

  return { ...user, lifetimeSpendMinor: spend._sum.totalMinor ?? 0, audit };
}

// ---------------------------------------------------------------------------
// Suppliers and verification
// ---------------------------------------------------------------------------

export type AdminSupplierRow = {
  id: string;
  businessName: string;
  slug: string;
  verificationStatus: VerificationStatus;
  isSuspended: boolean;
  isDemo: boolean;
  provinceName: string;
  districtName: string | null;
  contactName: string;
  contactEmail: string;
  documentsPending: number;
  productCount: number;
  completedOrders: number;
  ratingAverageBps: number;
  ratingCount: number;
  createdAt: Date;
};

export async function listSuppliersForAdmin(
  options: {
    status?: VerificationStatus | "SUSPENDED_ONLY";
    search?: string;
    page?: number;
  } = {},
): Promise<{ suppliers: AdminSupplierRow[]; total: number; page: number; pageCount: number }> {
  const page = Math.max(1, options.page ?? 1);
  const where: Prisma.SupplierProfileWhereInput = { deletedAt: null };

  if (options.status === "SUSPENDED_ONLY") where.isSuspended = true;
  else if (options.status) where.verificationStatus = options.status;

  if (options.search) {
    where.OR = [
      { businessName: { contains: options.search, mode: "insensitive" } },
      { email: { contains: options.search, mode: "insensitive" } },
      { registrationNumber: { contains: options.search, mode: "insensitive" } },
    ];
  }

  const [total, suppliers] = await Promise.all([
    db.supplierProfile.count({ where }),
    db.supplierProfile.findMany({
      where,
      // Businesses waiting on BuildLink come first: this list is a work queue.
      orderBy: [{ verificationStatus: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        businessName: true,
        slug: true,
        verificationStatus: true,
        isSuspended: true,
        isDemo: true,
        completedOrders: true,
        ratingAverageBps: true,
        ratingCount: true,
        createdAt: true,
        province: { select: { name: true } },
        district: { select: { name: true } },
        user: { select: { name: true, email: true } },
        _count: {
          select: {
            products: { where: { deletedAt: null } },
            documents: { where: { reviewStatus: "PENDING" } },
          },
        },
      },
    }),
  ]);

  return {
    suppliers: suppliers.map((supplier) => ({
      id: supplier.id,
      businessName: supplier.businessName,
      slug: supplier.slug,
      verificationStatus: supplier.verificationStatus,
      isSuspended: supplier.isSuspended,
      isDemo: supplier.isDemo,
      provinceName: supplier.province.name,
      districtName: supplier.district?.name ?? null,
      contactName: supplier.user.name,
      contactEmail: supplier.user.email,
      documentsPending: supplier._count.documents,
      productCount: supplier._count.products,
      completedOrders: supplier.completedOrders,
      ratingAverageBps: supplier.ratingAverageBps,
      ratingCount: supplier.ratingCount,
      createdAt: supplier.createdAt,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
  };
}

export type AdminSupplierDetail = Awaited<ReturnType<typeof getSupplierForAdmin>>;

export async function getSupplierForAdmin(supplierId: string) {
  const supplier = await db.supplierProfile.findFirst({
    where: { id: supplierId, deletedAt: null },
    select: {
      id: true,
      businessName: true,
      slug: true,
      description: true,
      logoKey: true,
      phone: true,
      email: true,
      address: true,
      yearsOperating: true,
      registrationNumber: true,
      taxpayerNumber: true,
      businessRegistrationStatus: true,
      verificationStatus: true,
      verifiedAt: true,
      isSuspended: true,
      suspendedReason: true,
      isDemo: true,
      subscriptionTier: true,
      commissionRateBps: true,
      deliveryAvailable: true,
      minimumOrderMinor: true,
      totalOrders: true,
      completedOrders: true,
      cancelledOrders: true,
      ratingAverageBps: true,
      ratingCount: true,
      averageResponseMinutes: true,
      createdAt: true,
      province: { select: { name: true } },
      district: { select: { name: true } },
      user: { select: { id: true, name: true, email: true, phone: true, status: true } },
      categories: { select: { id: true, name: true } },
      documents: {
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
          reviewedBy: { select: { name: true } },
        },
      },
      verifications: {
        orderBy: { submittedAt: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          submittedAt: true,
          reviewedAt: true,
          decisionNote: true,
          reviewedBy: { select: { name: true } },
        },
      },
      products: {
        where: { deletedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: { id: true, name: true, status: true, priceMinor: true, unit: true },
      },
    },
  });

  if (!supplier) throw new NotFoundError("supplier");

  const [deliveriesCompleted, deliveriesAttempted, openDisputes, resolvedDisputes, revenue] =
    await Promise.all([
      db.delivery.count({ where: { order: { supplierId }, status: "DELIVERED" } }),
      db.delivery.count({
        where: { order: { supplierId }, status: { in: ["DELIVERED", "FAILED"] } },
      }),
      db.dispute.count({ where: { supplierId, status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
      db.dispute.count({ where: { supplierId, status: { in: ["RESOLVED", "CLOSED"] } } }),
      db.order.aggregate({
        where: { supplierId, status: { in: ["DELIVERED", "COMPLETED"] } },
        _sum: { totalMinor: true, commissionMinor: true },
      }),
    ]);

  const trust = calculateTrustScore({
    verificationStatus: supplier.verificationStatus,
    ratingAverageBps: supplier.ratingAverageBps,
    ratingCount: supplier.ratingCount,
    completedOrders: supplier.completedOrders,
    cancelledOrders: supplier.cancelledOrders,
    totalOrders: supplier.totalOrders,
    deliveriesCompleted,
    deliveriesAttempted,
    openDisputes,
    resolvedDisputes,
    averageResponseMinutes: supplier.averageResponseMinutes,
  });

  return {
    ...supplier,
    logoUrl: fileUrl(supplier.logoKey),
    documents: supplier.documents.map((document) => ({
      ...document,
      url: `/api/files/${document.fileKey}`,
    })),
    trust,
    disputes: { open: openDisputes, resolved: resolvedDisputes },
    revenueMinor: revenue._sum.totalMinor ?? 0,
    commissionMinor: revenue._sum.commissionMinor ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Product moderation
// ---------------------------------------------------------------------------

export type AdminProductRow = {
  id: string;
  name: string;
  brand: string | null;
  status: ProductStatus;
  priceMinor: number;
  unit: string;
  stockQuantity: number;
  categoryName: string;
  supplierId: string;
  supplierName: string;
  supplierVerified: boolean;
  isDemo: boolean;
  imageUrl: string | null;
  rejectionReason: string | null;
  updatedAt: Date;
};

export async function listProductsForAdmin(
  options: { status?: ProductStatus; search?: string; page?: number } = {},
): Promise<{ products: AdminProductRow[]; total: number; page: number; pageCount: number }> {
  const page = Math.max(1, options.page ?? 1);
  const where: Prisma.ProductWhereInput = { deletedAt: null };

  if (options.status) where.status = options.status;
  if (options.search) {
    where.OR = [
      { name: { contains: options.search, mode: "insensitive" } },
      { brand: { contains: options.search, mode: "insensitive" } },
      { supplier: { businessName: { contains: options.search, mode: "insensitive" } } },
    ];
  }

  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      // Oldest first inside the moderation queue: a supplier who has waited
      // longest is served first.
      orderBy: options.status === "PENDING_APPROVAL" ? { updatedAt: "asc" } : { updatedAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        brand: true,
        status: true,
        priceMinor: true,
        unit: true,
        stockQuantity: true,
        rejectionReason: true,
        updatedAt: true,
        category: { select: { name: true } },
        supplier: {
          select: { id: true, businessName: true, verificationStatus: true, isDemo: true },
        },
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
      priceMinor: product.priceMinor,
      unit: product.unit,
      stockQuantity: product.stockQuantity,
      categoryName: product.category.name,
      supplierId: product.supplier.id,
      supplierName: product.supplier.businessName,
      supplierVerified: product.supplier.verificationStatus === "VERIFIED",
      isDemo: product.supplier.isDemo,
      imageUrl: fileUrl(product.images[0]?.fileKey ?? null),
      rejectionReason: product.rejectionReason,
      updatedAt: product.updatedAt,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
  };
}

export async function countProductsByStatus(): Promise<Partial<Record<ProductStatus, number>>> {
  const rows = await db.product.groupBy({
    by: ["status"],
    where: { deletedAt: null },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export type AdminPaymentRow = {
  id: string;
  reference: string;
  status: PaymentStatus;
  method: string;
  amountMinor: number;
  provider: string | null;
  providerReference: string | null;
  failureReason: string | null;
  orderId: string | null;
  orderNumber: string | null;
  customerName: string;
  supplierName: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
};

export async function listPaymentsForAdmin(
  options: { status?: PaymentStatus; search?: string; page?: number } = {},
): Promise<{
  payments: AdminPaymentRow[];
  total: number;
  page: number;
  pageCount: number;
  totals: { settledMinor: number; pendingMinor: number };
}> {
  const page = Math.max(1, options.page ?? 1);
  const where: Prisma.PaymentWhereInput = {};

  if (options.status) where.status = options.status;
  if (options.search) {
    where.OR = [
      { reference: { contains: options.search, mode: "insensitive" } },
      { providerReference: { contains: options.search, mode: "insensitive" } },
      { order: { orderNumber: { contains: options.search, mode: "insensitive" } } },
      { customer: { name: { contains: options.search, mode: "insensitive" } } },
    ];
  }

  const [total, payments, settled, pending] = await Promise.all([
    db.payment.count({ where }),
    db.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        reference: true,
        status: true,
        method: true,
        amountMinor: true,
        provider: true,
        providerReference: true,
        failureReason: true,
        confirmedAt: true,
        createdAt: true,
        orderId: true,
        order: { select: { orderNumber: true } },
        customer: { select: { name: true } },
        supplier: { select: { businessName: true } },
      },
    }),
    db.payment.aggregate({ where: { status: "SUCCESSFUL" }, _sum: { amountMinor: true } }),
    db.payment.aggregate({
      where: { status: { in: ["INITIATED", "PENDING"] } },
      _sum: { amountMinor: true },
    }),
  ]);

  return {
    payments: payments.map((payment) => ({
      id: payment.id,
      reference: payment.reference,
      status: payment.status,
      method: payment.method,
      amountMinor: payment.amountMinor,
      provider: payment.provider,
      providerReference: payment.providerReference,
      failureReason: payment.failureReason,
      orderId: payment.orderId,
      orderNumber: payment.order?.orderNumber ?? null,
      customerName: payment.customer.name,
      supplierName: payment.supplier?.businessName ?? null,
      confirmedAt: payment.confirmedAt,
      createdAt: payment.createdAt,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
    totals: {
      settledMinor: settled._sum.amountMinor ?? 0,
      pendingMinor: pending._sum.amountMinor ?? 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Disputes
// ---------------------------------------------------------------------------

export type AdminDisputeRow = Awaited<ReturnType<typeof listDisputes>>[number];

export async function listDisputes(options: { status?: DisputeStatus } = {}) {
  return db.dispute.findMany({
    where: options.status ? { status: options.status } : {},
    // Open first, then oldest — a dispute nobody has looked at is the worst
    // thing in this console.
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    take: 100,
    select: {
      id: true,
      reason: true,
      description: true,
      status: true,
      resolution: true,
      createdAt: true,
      resolvedAt: true,
      raisedBy: { select: { id: true, name: true, role: true } },
      supplier: { select: { id: true, businessName: true } },
      order: {
        select: { id: true, orderNumber: true, totalMinor: true, status: true },
      },
    },
  });
}

export async function getDisputeForAdmin(disputeId: string) {
  const dispute = await db.dispute.findUnique({
    where: { id: disputeId },
    select: {
      id: true,
      reason: true,
      description: true,
      status: true,
      resolution: true,
      createdAt: true,
      updatedAt: true,
      resolvedAt: true,
      raisedBy: { select: { id: true, name: true, email: true, phone: true, role: true } },
      resolvedBy: { select: { name: true } },
      supplier: {
        select: {
          id: true,
          businessName: true,
          phone: true,
          email: true,
          verificationStatus: true,
          user: { select: { name: true } },
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalMinor: true,
          placedAt: true,
          fulfilmentMethod: true,
          customer: { select: { id: true, name: true, phone: true, email: true } },
          items: {
            select: { id: true, productName: true, quantity: true, unit: true, lineTotalMinor: true },
          },
          payments: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              reference: true,
              status: true,
              method: true,
              amountMinor: true,
              createdAt: true,
            },
          },
          delivery: {
            select: {
              status: true,
              method: true,
              receivedBy: true,
              deliveredAt: true,
              failureReason: true,
              proofFileKey: true,
            },
          },
        },
      },
    },
  });

  if (!dispute) throw new NotFoundError("dispute");

  return {
    ...dispute,
    proofUrl: fileUrl(dispute.order.delivery?.proofFileKey ?? null),
  };
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export async function listReviewsForAdmin(
  options: { status?: ReviewStatus; page?: number } = {},
) {
  const page = Math.max(1, options.page ?? 1);
  const where: Prisma.ReviewWhereInput = options.status ? { status: options.status } : {};

  const [total, reviews] = await Promise.all([
    db.review.count({ where }),
    db.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        rating: true,
        comment: true,
        status: true,
        hiddenReason: true,
        amendmentAllowed: true,
        createdAt: true,
        customer: { select: { name: true } },
        supplier: { select: { id: true, businessName: true } },
        order: { select: { id: true, orderNumber: true } },
      },
    }),
  ]);

  return {
    reviews,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
  };
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export async function listAuditLog(
  options: { action?: string; resourceType?: string; search?: string; page?: number } = {},
) {
  const page = Math.max(1, options.page ?? 1);
  const where: Prisma.AuditLogWhereInput = {};

  if (options.action) where.action = options.action;
  if (options.resourceType) where.resourceType = options.resourceType;
  if (options.search) {
    where.OR = [
      { resourceId: options.search },
      { actor: { name: { contains: options.search, mode: "insensitive" } } },
      { actor: { email: { contains: options.search, mode: "insensitive" } } },
    ];
  }

  const [total, entries, actions] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        action: true,
        resourceType: true,
        resourceId: true,
        previousValue: true,
        newValue: true,
        ipAddress: true,
        createdAt: true,
        actorRole: true,
        actor: { select: { id: true, name: true, email: true } },
      },
    }),
    db.auditLog.groupBy({ by: ["action"], _count: { _all: true }, orderBy: { action: "asc" } }),
  ]);

  return {
    entries,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
    actions: actions.map((row) => ({ action: row.action, count: row._count._all })),
  };
}

// ---------------------------------------------------------------------------
// Platform analytics
// ---------------------------------------------------------------------------

export type PlatformAnalytics = Awaited<ReturnType<typeof getPlatformAnalytics>>;

export async function getPlatformAnalytics(days = 90) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [
    monthly,
    ordersByStatus,
    usersByRole,
    topSuppliers,
    topCategories,
    fulfilment,
    provinces,
    events,
    reviewStats,
  ] = await Promise.all([
    db.$queryRaw<Array<{ month: Date; orders: bigint; gmv_minor: bigint | null }>>`
      SELECT date_trunc('month', COALESCE(o."placedAt", o."createdAt")) AS month,
             count(*) AS orders,
             sum(o."totalMinor") FILTER (
               WHERE o."status" IN ('DELIVERED', 'COMPLETED')
             ) AS gmv_minor
      FROM "Order" o
      WHERE COALESCE(o."placedAt", o."createdAt") >= ${since}
        AND o."status" <> 'DRAFT'
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    db.order.groupBy({
      by: ["status"],
      where: { status: { not: "DRAFT" }, createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { totalMinor: true },
    }),
    db.user.groupBy({ by: ["role"], where: { deletedAt: null }, _count: { _all: true } }),
    db.order.groupBy({
      by: ["supplierId"],
      where: { status: { in: ["DELIVERED", "COMPLETED"] }, createdAt: { gte: since } },
      _sum: { totalMinor: true, commissionMinor: true },
      _count: { _all: true },
      orderBy: { _sum: { totalMinor: "desc" } },
      take: 8,
    }),
    db.$queryRaw<Array<{ category: string; orders: bigint; gmv_minor: bigint | null }>>`
      SELECT c."name" AS category,
             count(DISTINCT o."id") AS orders,
             sum(oi."lineTotalMinor") AS gmv_minor
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      LEFT JOIN "Product" p ON p."id" = oi."productId"
      LEFT JOIN "ProductCategory" c ON c."id" = p."categoryId"
      WHERE o."status" IN ('DELIVERED', 'COMPLETED')
        AND o."createdAt" >= ${since}
        AND c."name" IS NOT NULL
      GROUP BY 1
      ORDER BY 3 DESC
      LIMIT 8
    `,
    db.order.groupBy({
      by: ["fulfilmentMethod"],
      where: { status: { not: "DRAFT" }, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    db.$queryRaw<Array<{ province: string; suppliers: bigint }>>`
      SELECT pr."name" AS province, count(s."id") AS suppliers
      FROM "SupplierProfile" s
      JOIN "Province" pr ON pr."id" = s."provinceId"
      WHERE s."deletedAt" IS NULL
      GROUP BY 1
      ORDER BY 2 DESC
    `,
    db.analyticsEvent.groupBy({
      by: ["name"],
      where: { occurredAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { name: "desc" } },
      take: 12,
    }),
    db.review.aggregate({
      where: { status: "PUBLISHED" },
      _avg: { rating: true },
      _count: { _all: true },
    }),
  ]);

  const supplierNames = await db.supplierProfile.findMany({
    where: { id: { in: topSuppliers.map((row) => row.supplierId) } },
    select: { id: true, businessName: true, isDemo: true },
  });
  const nameById = new Map(supplierNames.map((row) => [row.id, row]));

  const placed = ordersByStatus.reduce((total, row) => total + row._count._all, 0);
  const completed = ordersByStatus
    .filter((row) => row.status === "COMPLETED" || row.status === "DELIVERED")
    .reduce((total, row) => total + row._count._all, 0);
  const cancelled = ordersByStatus
    .filter((row) => row.status === "CANCELLED")
    .reduce((total, row) => total + row._count._all, 0);
  const gmvMinor = ordersByStatus
    .filter((row) => row.status === "COMPLETED" || row.status === "DELIVERED")
    .reduce((total, row) => total + (row._sum.totalMinor ?? 0), 0);

  return {
    windowDays: days,
    orders: { placed, completed, cancelled },
    gmvMinor,
    averageOrderMinor: completed === 0 ? 0 : Math.round(gmvMinor / completed),
    monthly: monthly.map((row) => ({
      month: row.month,
      orders: Number(row.orders),
      gmvMinor: Number(row.gmv_minor ?? 0),
    })),
    usersByRole: usersByRole.map((row) => ({ role: row.role, count: row._count._all })),
    topSuppliers: topSuppliers.flatMap((row) => {
      const supplier = nameById.get(row.supplierId);
      if (!supplier) return [];
      return [
        {
          id: row.supplierId,
          name: supplier.businessName,
          isDemo: supplier.isDemo,
          orders: row._count._all,
          gmvMinor: row._sum.totalMinor ?? 0,
          commissionMinor: row._sum.commissionMinor ?? 0,
        },
      ];
    }),
    topCategories: topCategories.map((row) => ({
      category: row.category,
      orders: Number(row.orders),
      gmvMinor: Number(row.gmv_minor ?? 0),
    })),
    fulfilment: fulfilment.map((row) => ({
      method: row.fulfilmentMethod,
      count: row._count._all,
    })),
    suppliersByProvince: provinces.map((row) => ({
      province: row.province,
      suppliers: Number(row.suppliers),
    })),
    events: events.map((row) => ({ name: row.name, count: row._count._all })),
    rating: { average: reviewStats._avg.rating ?? 0, count: reviewStats._count._all },
  };
}
