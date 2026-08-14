import "server-only";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { isAdminRole } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/session";
import { summariseBudget, summariseWallet, type BudgetRollup, type WalletSummary } from "@/lib/domain/budget";
import { OPEN_ORDER_STATUSES, TERMINAL_ORDER_STATUSES } from "@/lib/domain/order-status";
import { fileUrl } from "@/lib/services/storage";
import type {
  ConstructionStage,
  ConstructionType,
  ProjectStatus,
  PropertyType,
} from "@prisma/client";

/**
 * Customer-side reads.
 *
 * Ownership is part of every `where` clause rather than checked afterwards, so a
 * guessed project id returns "not found" instead of somebody else's build. The
 * only exception is an administrator, who is allowed through for support and
 * whose access the audit log records.
 */

export type ProjectSummary = {
  id: string;
  name: string;
  propertyType: PropertyType;
  constructionType: ConstructionType;
  stage: ConstructionStage;
  status: ProjectStatus;
  progressPercent: number;
  estimatedBudgetMinor: number;
  spentMinor: number;
  remainingMinor: number;
  consumedPercent: number;
  isOverBudget: boolean;
  provinceName: string;
  districtName: string | null;
  locationDetail: string | null;
  imageUrl: string | null;
  openOrderCount: number;
  targetCompletionDate: Date | null;
  updatedAt: Date;
};

function ownershipWhere(user: SessionUser) {
  return isAdminRole(user.role) ? {} : { customerId: user.id };
}

export async function listProjects(user: SessionUser): Promise<ProjectSummary[]> {
  const projects = await db.project.findMany({
    where: { ...ownershipWhere(user), deletedAt: null },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      propertyType: true,
      constructionType: true,
      stage: true,
      status: true,
      progressPercent: true,
      estimatedBudgetMinor: true,
      locationDetail: true,
      imageKey: true,
      targetCompletionDate: true,
      updatedAt: true,
      province: { select: { name: true } },
      district: { select: { name: true } },
      budget: { select: { categories: { select: { id: true, key: true, plannedMinor: true } } } },
      transactions: { select: { categoryId: true, type: true, amountMinor: true } },
      _count: { select: { orders: { where: { status: { in: [...OPEN_ORDER_STATUSES] } } } } },
    },
  });

  return projects.map((project) => {
    const rollup = summariseBudget({
      estimatedBudgetMinor: project.estimatedBudgetMinor,
      categories: project.budget?.categories ?? [],
      transactions: project.transactions,
    });

    return {
      id: project.id,
      name: project.name,
      propertyType: project.propertyType,
      constructionType: project.constructionType,
      stage: project.stage,
      status: project.status,
      progressPercent: project.progressPercent,
      estimatedBudgetMinor: rollup.plannedMinor,
      spentMinor: rollup.spentMinor,
      remainingMinor: rollup.remainingMinor,
      consumedPercent: rollup.consumedPercent,
      isOverBudget: rollup.isOverBudget,
      provinceName: project.province.name,
      districtName: project.district?.name ?? null,
      locationDetail: project.locationDetail,
      imageUrl: fileUrl(project.imageKey),
      openOrderCount: project._count.orders,
      targetCompletionDate: project.targetCompletionDate,
      updatedAt: project.updatedAt,
    };
  });
}

export type ProjectDetail = Awaited<ReturnType<typeof getProject>>;

export async function getProject(projectId: string, user: SessionUser) {
  const project = await db.project.findFirst({
    where: { id: projectId, ...ownershipWhere(user), deletedAt: null },
    select: {
      id: true,
      name: true,
      propertyType: true,
      constructionType: true,
      provinceId: true,
      districtId: true,
      locationDetail: true,
      bedrooms: true,
      approximateSizeSqm: true,
      stage: true,
      status: true,
      estimatedBudgetMinor: true,
      startDate: true,
      targetCompletionDate: true,
      description: true,
      imageKey: true,
      progressPercent: true,
      createdAt: true,
      updatedAt: true,
      customerId: true,
      province: { select: { id: true, name: true } },
      district: { select: { id: true, name: true } },
    },
  });

  if (!project) throw new NotFoundError("project");
  return { ...project, imageUrl: fileUrl(project.imageKey) };
}

export type ProjectBudgetView = {
  rollup: BudgetRollup;
  categories: Array<{
    id: string;
    key: BudgetRollup["categories"][number]["key"];
    plannedMinor: number;
    spentMinor: number;
    remainingMinor: number;
    consumedPercent: number;
    isOverBudget: boolean;
    isNearLimit: boolean;
  }>;
  transactions: Array<{
    id: string;
    type: string;
    amountMinor: number;
    description: string;
    occurredAt: Date;
    categoryId: string | null;
    orderId: string | null;
    orderNumber: string | null;
  }>;
  wallet: WalletSummary;
  walletEntries: Array<{
    id: string;
    type: string;
    amountMinor: number;
    description: string;
    reference: string | null;
    createdAt: Date;
  }>;
};

export async function getProjectBudget(
  projectId: string,
  user: SessionUser,
): Promise<ProjectBudgetView> {
  const project = await db.project.findFirst({
    where: { id: projectId, ...ownershipWhere(user), deletedAt: null },
    select: {
      estimatedBudgetMinor: true,
      budget: {
        select: {
          categories: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, key: true, plannedMinor: true },
          },
        },
      },
      transactions: {
        orderBy: { occurredAt: "desc" },
        select: {
          id: true,
          type: true,
          amountMinor: true,
          description: true,
          occurredAt: true,
          categoryId: true,
          orderId: true,
          order: { select: { orderNumber: true } },
        },
      },
      walletEntries: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          amountMinor: true,
          description: true,
          reference: true,
          createdAt: true,
        },
      },
    },
  });

  if (!project) throw new NotFoundError("project");

  const rollup = summariseBudget({
    estimatedBudgetMinor: project.estimatedBudgetMinor,
    categories: project.budget?.categories ?? [],
    transactions: project.transactions,
  });

  return {
    rollup,
    categories: rollup.categories,
    transactions: project.transactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      amountMinor: transaction.amountMinor,
      description: transaction.description,
      occurredAt: transaction.occurredAt,
      categoryId: transaction.categoryId,
      orderId: transaction.orderId,
      orderNumber: transaction.order?.orderNumber ?? null,
    })),
    wallet: summariseWallet(project.walletEntries),
    walletEntries: project.walletEntries,
  };
}

export type CustomerDashboard = {
  projects: ProjectSummary[];
  activeProject: ProjectSummary | null;
  totals: {
    plannedMinor: number;
    spentMinor: number;
    remainingMinor: number;
    consumedPercent: number;
    walletBalanceMinor: number;
  };
  openOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    totalMinor: number;
    supplierName: string;
    supplierSlug: string;
    placedAt: Date | null;
    itemCount: number;
  }>;
  awaitingReview: Array<{
    id: string;
    orderNumber: string;
    supplierName: string;
    completedAt: Date | null;
  }>;
  pendingContracts: number;
  unreadNotifications: number;
  cartItemCount: number;
};

/** Everything the customer dashboard renders, in one round of queries. */
export async function getCustomerDashboard(user: SessionUser): Promise<CustomerDashboard> {
  const projects = await listProjects(user);

  const [openOrders, completedWithoutReview, pendingContracts, unread, cartItems, walletTotals] =
    await Promise.all([
      db.order.findMany({
        where: { customerId: user.id, status: { in: [...OPEN_ORDER_STATUSES] } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalMinor: true,
          placedAt: true,
          supplier: { select: { businessName: true, slug: true } },
          _count: { select: { items: true } },
        },
      }),
      db.order.findMany({
        where: { customerId: user.id, status: "COMPLETED", review: null },
        orderBy: { completedAt: "desc" },
        take: 3,
        select: {
          id: true,
          orderNumber: true,
          completedAt: true,
          supplier: { select: { businessName: true } },
        },
      }),
      // Agreements waiting on *this* customer, not ones they sent themselves.
      db.contract.count({
        where: { customerId: user.id, status: "SENT", createdByRole: "SUPPLIER" },
      }),
      db.notification.count({ where: { userId: user.id, readAt: null, channel: "IN_APP" } }),
      db.cartItem.count({ where: { cart: { userId: user.id, checkedOutAt: null } } }),
      db.walletEntry.findMany({
        where: { project: { customerId: user.id, deletedAt: null } },
        select: { type: true, amountMinor: true },
      }),
    ]);

  const activeProject =
    projects.find((project) => project.status === "ACTIVE") ?? projects[0] ?? null;

  const totals = projects.reduce(
    (accumulator, project) => ({
      plannedMinor: accumulator.plannedMinor + project.estimatedBudgetMinor,
      spentMinor: accumulator.spentMinor + project.spentMinor,
    }),
    { plannedMinor: 0, spentMinor: 0 },
  );

  const wallet = summariseWallet(walletTotals);

  return {
    projects,
    activeProject,
    totals: {
      plannedMinor: totals.plannedMinor,
      spentMinor: totals.spentMinor,
      remainingMinor: totals.plannedMinor - totals.spentMinor,
      consumedPercent:
        totals.plannedMinor > 0
          ? Math.min(100, Math.round((totals.spentMinor / totals.plannedMinor) * 100))
          : 0,
      walletBalanceMinor: wallet.balanceMinor,
    },
    openOrders: openOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalMinor: order.totalMinor,
      supplierName: order.supplier.businessName,
      supplierSlug: order.supplier.slug,
      placedAt: order.placedAt,
      itemCount: order._count.items,
    })),
    awaitingReview: completedWithoutReview.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      supplierName: order.supplier.businessName,
      completedAt: order.completedAt,
    })),
    pendingContracts,
    unreadNotifications: unread,
    cartItemCount: cartItems,
  };
}

/** Projects a customer can attach a cart or order to. */
export async function listProjectOptions(
  userId: string,
): Promise<Array<{ id: string; name: string }>> {
  return db.project.findMany({
    where: {
      customerId: userId,
      deletedAt: null,
      status: { notIn: ["CANCELLED", "COMPLETED"] },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true },
  });
}

/** Order history for one project, used on the project detail page. */
export async function listProjectOrders(projectId: string, user: SessionUser) {
  const orders = await db.order.findMany({
    where: { projectId, ...(isAdminRole(user.role) ? {} : { customerId: user.id }) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalMinor: true,
      placedAt: true,
      supplier: { select: { businessName: true } },
    },
  });

  return orders.map((order) => ({
    ...order,
    supplierName: order.supplier.businessName,
    isClosed: TERMINAL_ORDER_STATUSES.includes(order.status),
  }));
}
