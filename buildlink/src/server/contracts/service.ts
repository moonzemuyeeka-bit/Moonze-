import "server-only";
import type { ContractPartyRole, ContractStatus } from "@prisma/client";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/permissions";
import { NotFoundError } from "@/lib/errors";

/**
 * Agreement services shared by the customer and supplier surfaces.
 *
 * Kept out of the `"use server"` module so `loadContractForActor` — which
 * answers "who is this person to this agreement?" — can be reused by pages
 * without becoming a callable endpoint of its own.
 */

export type ContractForActor = {
  id: string;
  contractNumber: string;
  version: number;
  status: ContractStatus;
  createdByRole: ContractPartyRole;
  orderId: string | null;
  orderNumber: string | null;
  orderStatus: string | null;
  projectId: string | null;
  customerId: string;
  customerName: string;
  supplierId: string;
  supplierUserId: string;
  supplierName: string;
  totalMinor: number;
  /** The role this actor holds on this agreement, or null for an admin observer. */
  actorRole: ContractPartyRole | null;
};

export async function loadContractForActor(
  contractId: string,
  user: SessionUser,
): Promise<ContractForActor> {
  const contract = await db.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      contractNumber: true,
      version: true,
      status: true,
      createdByRole: true,
      orderId: true,
      projectId: true,
      customerId: true,
      supplierId: true,
      totalMinor: true,
      customer: { select: { name: true } },
      order: { select: { orderNumber: true, status: true } },
      supplier: { select: { userId: true, businessName: true } },
    },
  });

  if (!contract) throw new NotFoundError("agreement");

  const isCustomer = contract.customerId === user.id;
  const isSupplier = contract.supplier.userId === user.id;
  if (!isCustomer && !isSupplier && !isAdminRole(user.role)) {
    throw new NotFoundError("agreement");
  }

  return {
    id: contract.id,
    contractNumber: contract.contractNumber,
    version: contract.version,
    status: contract.status,
    createdByRole: contract.createdByRole,
    orderId: contract.orderId,
    orderNumber: contract.order?.orderNumber ?? null,
    orderStatus: contract.order?.status ?? null,
    projectId: contract.projectId,
    customerId: contract.customerId,
    customerName: contract.customer.name,
    supplierId: contract.supplierId,
    supplierUserId: contract.supplier.userId,
    supplierName: contract.supplier.businessName,
    totalMinor: contract.totalMinor,
    actorRole: isCustomer ? "CUSTOMER" : isSupplier ? "SUPPLIER" : null,
  };
}
