import "server-only";
import type { ContractStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/permissions";
import { NotFoundError } from "@/lib/errors";
import { canRespondToContract, counterpartyOf } from "@/lib/domain/contract-status";

/**
 * Agreement reads.
 *
 * The audience is always in the `where` clause. `awaitingMe` is computed rather
 * than stored, because "is it my turn?" depends on who is asking: the same SENT
 * agreement is a waiting task for one party and a sent document for the other.
 */

export type ContractAudience =
  | { kind: "customer"; userId: string }
  | { kind: "supplier"; supplierId: string }
  | { kind: "admin" };

function audienceWhere(audience: ContractAudience): Prisma.ContractWhereInput {
  switch (audience.kind) {
    case "customer":
      return { customerId: audience.userId };
    case "supplier":
      return { supplierId: audience.supplierId };
    case "admin":
      return {};
  }
}

export type ContractListItem = {
  id: string;
  contractNumber: string;
  status: ContractStatus;
  totalMinor: number;
  depositMinor: number;
  createdByRole: "CUSTOMER" | "SUPPLIER";
  orderId: string | null;
  orderNumber: string | null;
  customerName: string;
  supplierName: string;
  projectName: string | null;
  itemCount: number;
  sentAt: Date | null;
  respondedAt: Date | null;
  createdAt: Date;
  /** True when this audience is the one who has to accept or reject. */
  awaitingMe: boolean;
};

export async function listContracts(
  audience: ContractAudience,
  options: { status?: ContractStatus } = {},
): Promise<ContractListItem[]> {
  const contracts = await db.contract.findMany({
    where: {
      ...audienceWhere(audience),
      ...(options.status ? { status: options.status } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      contractNumber: true,
      status: true,
      totalMinor: true,
      depositMinor: true,
      createdByRole: true,
      orderId: true,
      sentAt: true,
      respondedAt: true,
      createdAt: true,
      order: { select: { orderNumber: true } },
      customer: { select: { name: true } },
      supplier: { select: { businessName: true } },
      project: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });

  const viewerRole =
    audience.kind === "customer" ? "CUSTOMER" : audience.kind === "supplier" ? "SUPPLIER" : null;

  return contracts.map((contract) => ({
    id: contract.id,
    contractNumber: contract.contractNumber,
    status: contract.status,
    totalMinor: contract.totalMinor,
    depositMinor: contract.depositMinor,
    createdByRole: contract.createdByRole,
    orderId: contract.orderId,
    orderNumber: contract.order?.orderNumber ?? null,
    customerName: contract.customer.name,
    supplierName: contract.supplier.businessName,
    projectName: contract.project?.name ?? null,
    itemCount: contract._count.items,
    sentAt: contract.sentAt,
    respondedAt: contract.respondedAt,
    createdAt: contract.createdAt,
    awaitingMe:
      viewerRole !== null &&
      canRespondToContract(contract.status, viewerRole, contract.createdByRole),
  }));
}

export type ContractDetail = Awaited<ReturnType<typeof getContractDetail>>;

export async function getContractDetail(contractId: string, user: SessionUser) {
  const contract = await db.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      contractNumber: true,
      version: true,
      status: true,
      createdByRole: true,
      subtotalMinor: true,
      depositMinor: true,
      balanceMinor: true,
      deliveryFeeMinor: true,
      totalMinor: true,
      deliveryDate: true,
      deliveryLocation: true,
      terms: true,
      cancellationTerms: true,
      notes: true,
      sentAt: true,
      respondedAt: true,
      completedAt: true,
      createdAt: true,
      orderId: true,
      customerId: true,
      supplierId: true,
      customer: { select: { id: true, name: true, email: true, phone: true } },
      supplier: {
        select: {
          id: true,
          userId: true,
          businessName: true,
          slug: true,
          phone: true,
          email: true,
          address: true,
          verificationStatus: true,
          province: { select: { name: true } },
          district: { select: { name: true } },
        },
      },
      project: { select: { id: true, name: true } },
      order: { select: { id: true, orderNumber: true, status: true, fulfilmentMethod: true } },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          description: true,
          unit: true,
          quantity: true,
          unitPriceMinor: true,
          lineTotalMinor: true,
        },
      },
      acceptances: {
        orderBy: { acceptedAt: "asc" },
        select: {
          id: true,
          role: true,
          accepted: true,
          signatureName: true,
          contractVersion: true,
          acceptedAt: true,
          ipAddress: true,
          user: { select: { name: true } },
        },
      },
    },
  });

  if (!contract) throw new NotFoundError("agreement");

  const isCustomer = contract.customerId === user.id;
  const isSupplier = contract.supplier.userId === user.id;
  if (!isCustomer && !isSupplier && !isAdminRole(user.role)) {
    throw new NotFoundError("agreement");
  }

  const actorRole = isCustomer ? "CUSTOMER" : isSupplier ? "SUPPLIER" : null;

  return {
    ...contract,
    viewer: {
      role: actorRole,
      isAdmin: isAdminRole(user.role),
      canRespond:
        actorRole !== null &&
        canRespondToContract(contract.status, actorRole, contract.createdByRole),
      canSend:
        actorRole === contract.createdByRole && contract.status === "DRAFT",
      awaitingRole: contract.status === "SENT" ? counterpartyOf(contract.createdByRole) : null,
    },
  };
}

/** Agreements this person still has to respond to, for dashboards and badges. */
export async function countAgreementsAwaiting(audience: ContractAudience): Promise<number> {
  if (audience.kind === "admin") {
    return db.contract.count({ where: { status: "SENT" } });
  }
  const createdBy = audience.kind === "customer" ? "SUPPLIER" : "CUSTOMER";
  return db.contract.count({
    where: { ...audienceWhere(audience), status: "SENT", createdByRole: createdBy },
  });
}
