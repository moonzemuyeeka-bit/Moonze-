import "server-only";
import type { Prisma, UserRole } from "@prisma/client";
import { db, type DatabaseClient } from "@/lib/db";
import { requestFingerprint } from "@/lib/auth/session";

/**
 * Audit logging.
 *
 * Every privileged or money-adjacent action appends a row here with the actor,
 * the resource and the before/after values. The admin console reads it directly,
 * and it is the record we would hand to a supplier disputing a suspension.
 *
 * Writing an audit entry must never break the action it describes, so failures
 * are logged and swallowed — except inside a transaction, where the caller has
 * deliberately made the audit entry part of the atomic unit.
 */

export const AUDIT_ACTIONS = {
  userRegistered: "user.registered",
  userSignedIn: "user.signed_in",
  userSuspended: "user.suspended",
  userReinstated: "user.reinstated",
  userRoleChanged: "user.role_changed",

  supplierApplied: "supplier.applied",
  supplierVerified: "supplier.verified",
  supplierVerificationRejected: "supplier.verification_rejected",
  supplierSuspended: "supplier.suspended",
  supplierReinstated: "supplier.reinstated",
  supplierDocumentReviewed: "supplier.document_reviewed",

  productCreated: "product.created",
  productUpdated: "product.updated",
  productApproved: "product.approved",
  productRejected: "product.rejected",
  productArchived: "product.archived",
  productStockAdjusted: "product.stock_adjusted",

  orderPlaced: "order.placed",
  orderStatusChanged: "order.status_changed",
  orderCancelled: "order.cancelled",

  paymentInitiated: "payment.initiated",
  paymentStatusChanged: "payment.status_changed",
  paymentRecorded: "payment.recorded_offline",
  refundRecorded: "payment.refund_recorded",

  walletDepositRecorded: "wallet.deposit_recorded",
  walletAllocated: "wallet.allocated",

  contractCreated: "contract.created",
  contractSent: "contract.sent",
  contractAccepted: "contract.accepted",
  contractRejected: "contract.rejected",
  contractCancelled: "contract.cancelled",

  deliveryCreated: "delivery.created",
  deliveryStatusChanged: "delivery.status_changed",
  deliveryAssigned: "delivery.assigned",

  reviewSubmitted: "review.submitted",
  reviewHidden: "review.hidden",
  reviewAmendmentAuthorised: "review.amendment_authorised",

  disputeOpened: "dispute.opened",
  disputeStatusChanged: "dispute.status_changed",
  disputeResolved: "dispute.resolved",

  platformSettingUpdated: "platform.setting_updated",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export type AuditEntry = {
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  actorUserId?: string | null;
  actorRole?: UserRole | null;
  previousValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
};

/**
 * Appends an audit entry. Pass `client` when the caller is inside a
 * `$transaction` so the log commits or rolls back with the change it describes.
 */
export async function recordAudit(
  entry: AuditEntry,
  client: DatabaseClient = db,
): Promise<void> {
  const isTransactional = client !== db;

  try {
    const { ipAddress, userAgent } = await safeFingerprint();
    await client.auditLog.create({
      data: {
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId ?? null,
        actorUserId: entry.actorUserId ?? null,
        actorRole: entry.actorRole ?? null,
        previousValue: entry.previousValue ?? undefined,
        newValue: entry.newValue ?? undefined,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    if (isTransactional) throw error;
    console.error("[buildlink] failed to write audit log entry:", entry.action, error);
  }
}

/**
 * `headers()` is unavailable outside a request scope (seed scripts, background
 * jobs), which must not stop an audit entry from being written.
 */
async function safeFingerprint(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
}> {
  try {
    return await requestFingerprint();
  } catch {
    return { ipAddress: null, userAgent: null };
  }
}

/**
 * Reduces an object to the named fields, for storing readable before/after
 * snapshots instead of whole rows (which would leak unrelated columns into the
 * audit log).
 */
export function auditSnapshot<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Prisma.InputJsonValue {
  const snapshot: Record<string, unknown> = {};
  for (const key of keys) {
    const value = source[key];
    snapshot[String(key)] = value instanceof Date ? value.toISOString() : (value ?? null);
  }
  return snapshot as Prisma.InputJsonValue;
}
