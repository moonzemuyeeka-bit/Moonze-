import "server-only";
import { randomBytes } from "node:crypto";
import type { OrderStatus, Prisma } from "@prisma/client";
import { db, type DatabaseClient } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/permissions";
import {
  CONTRACT_LEGAL_NOTICE,
  DEFAULT_CANCELLATION_TERMS,
  DEFAULT_CONTRACT_TERMS,
} from "@/lib/domain/contract-status";
import { budgetCategoryKeyFor } from "@/lib/catalogue";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { notify } from "@/lib/services/notifications";
import { ORDER_STATUS_LABELS } from "@/lib/labels";
import { NotFoundError } from "@/lib/errors";

/**
 * Order services shared by the checkout action, the supplier console and the
 * delivery module.
 *
 * These functions deliberately do **not** live in the `"use server"` action
 * module: everything exported from one of those becomes a callable endpoint, and
 * `applyOrderStatus` performs no authorisation of its own — its callers do.
 */

/** `BL-2026-XXXXXX`: readable in a WhatsApp message, unguessable in a URL. */
export function newOrderNumber(): string {
  return `BL-${new Date().getFullYear()}-${randomSuffix()}`;
}

export function newContractNumber(): string {
  return `AGR-${new Date().getFullYear()}-${randomSuffix()}`;
}

function randomSuffix(): string {
  return randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
}

export type OrderForActor = {
  id: string;
  status: OrderStatus;
  customerId: string;
  supplierId: string;
  projectId: string | null;
  orderNumber: string;
  totalMinor: number;
  supplierUserId: string;
  supplierName: string;
};

/**
 * Loads an order the signed-in user is a party to. A customer sees their own
 * orders, a supplier the orders placed with their business, an admin any of
 * them; anyone else gets a not-found rather than a hint that the order exists.
 */
export async function loadOrderForActor(
  orderId: string,
  user: SessionUser,
): Promise<OrderForActor> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      customerId: true,
      supplierId: true,
      projectId: true,
      orderNumber: true,
      totalMinor: true,
      supplier: { select: { userId: true, businessName: true } },
    },
  });

  if (!order) throw new NotFoundError("order");

  const isParty = order.customerId === user.id || order.supplier.userId === user.id;
  if (!isParty && !isAdminRole(user.role)) throw new NotFoundError("order");

  return {
    id: order.id,
    status: order.status,
    customerId: order.customerId,
    supplierId: order.supplierId,
    projectId: order.projectId,
    orderNumber: order.orderNumber,
    totalMinor: order.totalMinor,
    supplierUserId: order.supplier.userId,
    supplierName: order.supplier.businessName,
  };
}

/**
 * The single path through which an order status changes.
 *
 * It appends the timeline event, keeps stock and the supplier's counters
 * consistent, writes the audit entry and notifies the other party — so no caller
 * can change a status and forget one of those. Legality and authorisation are
 * the caller's job; by the time this runs, the move has been approved.
 */
export async function applyOrderStatus(input: {
  orderId: string;
  from: OrderStatus;
  to: OrderStatus;
  note: string | null;
  actor: SessionUser | null;
  cancellationReason?: string;
}): Promise<void> {
  const now = new Date();

  const order = await db.$transaction(async (tx) => {
    const data: Prisma.OrderUpdateInput = {
      status: input.to,
      events: {
        create: {
          fromStatus: input.from,
          toStatus: input.to,
          note: input.note,
          actorUserId: input.actor?.id ?? null,
          actorRole: input.actor?.role ?? null,
        },
      },
    };

    if (input.to === "CONFIRMED") data.confirmedAt = now;
    if (input.to === "COMPLETED") data.completedAt = now;
    if (input.to === "CANCELLED") {
      data.cancelledAt = now;
      data.cancellationReason = input.cancellationReason ?? input.note ?? null;
    }

    const updated = await tx.order.update({
      where: { id: input.orderId },
      data,
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        supplierId: true,
        projectId: true,
        totalMinor: true,
        items: { select: { productId: true, quantity: true } },
        supplier: { select: { userId: true, businessName: true } },
      },
    });

    // A cancelled order returns its stock — the mirror image of the reservation
    // made at checkout.
    if (input.to === "CANCELLED") {
      for (const item of updated.items) {
        if (!item.productId) continue;
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } },
        });
        await tx.inventory.updateMany({
          where: { productId: item.productId },
          data: { quantityReserved: { decrement: item.quantity } },
        });
      }

      // Release the commitment recorded against the project wallet. The budget
      // transaction goes with it, because nothing was actually spent.
      if (updated.projectId) {
        await tx.walletEntry.create({
          data: {
            projectId: updated.projectId,
            type: "ALLOCATION_RELEASED",
            amountMinor: updated.totalMinor,
            description: `Order ${updated.orderNumber} cancelled — commitment released`,
            reference: updated.orderNumber,
            orderId: updated.id,
          },
        });
        await tx.budgetTransaction.deleteMany({
          where: { orderId: updated.id, type: "MATERIAL_PURCHASE" },
        });
      }
    }

    // Reserved stock leaves the yard once the goods are delivered.
    if (input.to === "DELIVERED") {
      for (const item of updated.items) {
        if (!item.productId) continue;
        await tx.inventory.updateMany({
          where: { productId: item.productId },
          data: {
            quantityReserved: { decrement: item.quantity },
            quantityOnHand: { decrement: item.quantity },
          },
        });
      }
    }

    const counters = supplierCounterUpdate(input.to);
    if (Object.keys(counters).length > 0) {
      await tx.supplierProfile.update({ where: { id: updated.supplierId }, data: counters });
    }

    await recordAudit(
      {
        action:
          input.to === "CANCELLED"
            ? AUDIT_ACTIONS.orderCancelled
            : AUDIT_ACTIONS.orderStatusChanged,
        resourceType: "order",
        resourceId: updated.id,
        actorUserId: input.actor?.id ?? null,
        actorRole: input.actor?.role ?? null,
        previousValue: { status: input.from },
        newValue: { status: input.to, note: input.note },
      },
      tx,
    );

    return updated;
  });

  // Tell whichever party did not make the change.
  const actorIsCustomer = input.actor?.id === order.customerId;
  await notify({
    userId: actorIsCustomer ? order.supplier.userId : order.customerId,
    type: input.to === "CONFIRMED" ? "ORDER_ACCEPTED" : "ORDER_STATUS_CHANGED",
    title: `Order ${order.orderNumber}: ${ORDER_STATUS_LABELS[input.to]}`,
    body: input.note ?? `This order is now "${ORDER_STATUS_LABELS[input.to]}".`,
    linkUrl: actorIsCustomer ? `/supplier/orders/${order.id}` : `/orders/${order.id}`,
  });
}

/**
 * Supplier statistics that feed the trust score. `totalOrders` counts orders
 * that reached a decision, so a supplier is not penalised for baskets a customer
 * abandoned before paying.
 */
function supplierCounterUpdate(to: OrderStatus): Prisma.SupplierProfileUpdateInput {
  if (to === "COMPLETED") {
    return { completedOrders: { increment: 1 }, totalOrders: { increment: 1 } };
  }
  if (to === "CANCELLED") {
    return { cancelledOrders: { increment: 1 }, totalOrders: { increment: 1 } };
  }
  return {};
}

export type AgreementDraftItem = {
  productId: string;
  productName: string;
  brand: string | null;
  unit: Prisma.ContractItemCreateManyContractInput["unit"];
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
};

/**
 * Generates the agreement that accompanies an order.
 *
 * It is a structured record of what was agreed — items, prices, deposit,
 * balance, delivery and terms. It is explicitly not presented as a legally
 * enforceable instrument; `CONTRACT_LEGAL_NOTICE` is rendered on every one.
 *
 * It is created already SENT, because placing the order *is* the customer
 * putting the agreement forward. The supplier accepting it is how the order
 * becomes CONFIRMED.
 */
export async function createOrderAgreement(
  tx: DatabaseClient,
  input: {
    orderId: string;
    customerId: string;
    supplierId: string;
    projectId: string | null;
    subtotalMinor: number;
    deliveryFeeMinor: number;
    totalMinor: number;
    deliveryLocation: string;
    items: readonly AgreementDraftItem[];
  },
): Promise<void> {
  await tx.contract.create({
    data: {
      contractNumber: newContractNumber(),
      orderId: input.orderId,
      customerId: input.customerId,
      supplierId: input.supplierId,
      projectId: input.projectId,
      status: "SENT",
      sentAt: new Date(),
      createdByRole: "CUSTOMER",
      subtotalMinor: input.subtotalMinor,
      deliveryFeeMinor: input.deliveryFeeMinor,
      totalMinor: input.totalMinor,
      balanceMinor: input.totalMinor,
      deliveryLocation: input.deliveryLocation || null,
      terms: DEFAULT_CONTRACT_TERMS,
      cancellationTerms: DEFAULT_CANCELLATION_TERMS,
      notes: CONTRACT_LEGAL_NOTICE,
      items: {
        create: input.items.map((item) => ({
          productId: item.productId,
          description: item.brand ? `${item.productName} (${item.brand})` : item.productName,
          unit: item.unit,
          quantity: item.quantity,
          unitPriceMinor: item.unitPriceMinor,
          lineTotalMinor: item.lineTotalMinor,
        })),
      },
    },
  });
}

/**
 * Mirrors an order into the project's budget and wallet.
 *
 * This is the point of BuildLink for someone building a house: buying materials
 * updates the plan without anyone re-typing a figure. The wallet entry is an
 * ALLOCATION — money the customer has committed to a supplier, never money
 * BuildLink holds.
 */
export async function recordProjectCommitment(
  tx: DatabaseClient,
  input: {
    projectId: string;
    orderId: string;
    orderNumber: string;
    supplierName: string;
    totalMinor: number;
    userId: string;
    budgetKey: Prisma.BudgetCategoryCreateManyBudgetInput["key"];
  },
): Promise<void> {
  const budget = await tx.projectBudget.findUnique({
    where: { projectId: input.projectId },
    select: { id: true },
  });

  const category = budget
    ? await tx.budgetCategory.findUnique({
        where: { budgetId_key: { budgetId: budget.id, key: input.budgetKey } },
        select: { id: true },
      })
    : null;

  await tx.budgetTransaction.create({
    data: {
      projectId: input.projectId,
      categoryId: category?.id ?? null,
      type: "MATERIAL_PURCHASE",
      amountMinor: input.totalMinor,
      description: `Order ${input.orderNumber} — ${input.supplierName}`,
      orderId: input.orderId,
      createdById: input.userId,
    },
  });

  await tx.walletEntry.create({
    data: {
      projectId: input.projectId,
      type: "ALLOCATION",
      amountMinor: input.totalMinor,
      description: `Committed to ${input.supplierName} for order ${input.orderNumber}`,
      reference: input.orderNumber,
      orderId: input.orderId,
      createdById: input.userId,
    },
  });
}

/** Which budget line each product's purchase should land on. */
export async function budgetKeysForProducts(
  productIds: readonly string[],
): Promise<Map<string, Prisma.BudgetCategoryCreateManyBudgetInput["key"]>> {
  if (productIds.length === 0) return new Map();

  const products = await db.product.findMany({
    where: { id: { in: [...productIds] } },
    select: {
      id: true,
      category: { select: { slug: true, parent: { select: { slug: true } } } },
    },
  });

  return new Map(
    products.map((product) => [
      product.id,
      budgetCategoryKeyFor(product.category.slug, product.category.parent?.slug ?? null),
    ]),
  );
}
