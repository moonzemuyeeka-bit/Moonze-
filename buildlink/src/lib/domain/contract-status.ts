import type { ContractPartyRole, ContractStatus } from "@prisma/client";
import { InvalidTransitionError } from "@/lib/errors";

/**
 * Contract state machine.
 *
 * A BuildLink agreement is a structured record of what two parties agreed:
 * items, quantities, price, deposit, balance, delivery date and terms. It is
 * deliberately *not* presented as a legally enforceable instrument — see
 * `CONTRACT_LEGAL_NOTICE`, which is rendered on every agreement.
 */

export const CONTRACT_TRANSITIONS: Record<ContractStatus, readonly ContractStatus[]> = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["COMPLETED", "CANCELLED"],
  REJECTED: ["DRAFT", "CANCELLED"],
  CANCELLED: [],
  COMPLETED: [],
};

export function canTransitionContract(from: ContractStatus, to: ContractStatus): boolean {
  if (from === to) return false;
  return (CONTRACT_TRANSITIONS[from] ?? []).includes(to);
}

export function assertContractTransition(from: ContractStatus, to: ContractStatus): void {
  if (!canTransitionContract(from, to)) {
    throw new InvalidTransitionError("agreement", from, to);
  }
}

/** Only the counterparty who received the agreement may accept or reject it. */
export function canRespondToContract(
  status: ContractStatus,
  responder: ContractPartyRole,
  createdBy: ContractPartyRole,
): boolean {
  if (status !== "SENT") return false;
  return responder !== createdBy;
}

export const CONTRACT_LEGAL_NOTICE =
  "This is a digital record of what the customer and supplier agreed on BuildLink. " +
  "It has not been reviewed by a lawyer and BuildLink makes no representation that it " +
  "is enforceable under Zambian law. For high-value or complex work, have an agreement " +
  "prepared or reviewed by a qualified legal practitioner.";

export const DEFAULT_CONTRACT_TERMS = [
  "The supplier will supply the items listed at the unit prices shown.",
  "Prices are quoted in Zambian Kwacha (ZMW) and are fixed for this agreement.",
  "Any deposit is paid directly to the supplier. BuildLink records the payment but does not hold or guarantee funds.",
  "The supplier will confirm availability before the delivery date shown.",
  "The customer will inspect the goods on delivery and record any shortfall or damage on the delivery note.",
  "The balance is due on delivery unless the parties agree otherwise in writing.",
].join("\n");

export const DEFAULT_CANCELLATION_TERMS = [
  "Either party may cancel in writing before the supplier begins preparing the order.",
  "Once preparation has started, cancellation is at the supplier's discretion and any deposit refund is a matter between the parties.",
  "If the supplier cannot supply, the deposit is refundable in full.",
  "Disputes can be raised in BuildLink, which will make the agreement and order history available to both parties.",
].join("\n");

/**
 * Snapshot of what a contract version contained. Stored with each acceptance so
 * an amended agreement can never inherit an earlier signature.
 */
export type ContractSignatureContext = {
  contractNumber: string;
  version: number;
  totalMinor: number;
  itemCount: number;
};

export function describeAcceptance(input: {
  signatureName: string;
  role: ContractPartyRole;
  acceptedAt: Date;
  contractVersion: number;
}): string {
  const party = input.role === "CUSTOMER" ? "Customer" : "Supplier";
  return `${party} — ${input.signatureName} accepted version ${input.contractVersion} on ${input.acceptedAt.toISOString()}`;
}
