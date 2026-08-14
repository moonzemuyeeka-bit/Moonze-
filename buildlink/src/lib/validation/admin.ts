import { z } from "zod";
import {
  nonNegativeIntSchema,
  optionalText,
  requiredText,
  uuidSchema,
  zmwAmountSchema,
} from "@/lib/validation/shared";
import { DISPUTE_REASONS } from "@/lib/labels";
import type { PlatformSettingKey } from "@/lib/platform-settings";

/**
 * Administration input.
 *
 * Every schema here demands a written reason for anything that takes something
 * away from a person — suspending an account, rejecting a listing, hiding a
 * review. The reason is shown to the person affected and stored in the audit
 * log, so a decision can always be explained later.
 */

export const userStatusSchema = z
  .object({
    userId: uuidSchema,
    status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]),
    reason: optionalText(400),
  })
  .superRefine((value, ctx) => {
    if (value.status !== "ACTIVE" && !value.reason) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Say why. The account holder is told this reason.",
      });
    }
  });

/**
 * Roles an administrator may assign, in the order they are offered.
 *
 * `SUPER_ADMIN` is deliberately absent: the ability to grant the highest role
 * belongs in a deployment decision, not in a form a compromised admin session
 * could submit.
 */
export const ASSIGNABLE_ROLES = [
  "CUSTOMER",
  "SUPPLIER",
  "DELIVERY_PROVIDER",
  "PROFESSIONAL",
  "ARTISAN",
  "ADMIN",
] as const;

export const userRoleSchema = z.object({
  userId: uuidSchema,
  role: z.enum(ASSIGNABLE_ROLES),
  reason: requiredText("Reason", 400, 4),
});

export const verificationDecisionSchema = z
  .object({
    supplierId: uuidSchema,
    decision: z.enum(["VERIFIED", "REJECTED"]),
    note: optionalText(600),
  })
  .superRefine((value, ctx) => {
    if (value.decision === "REJECTED" && !value.note) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "Tell the supplier what was wrong so they can fix it.",
      });
    }
  });

export const documentDecisionSchema = z
  .object({
    documentId: uuidSchema,
    decision: z.enum(["APPROVED", "REJECTED"]),
    note: optionalText(400),
  })
  .superRefine((value, ctx) => {
    if (value.decision === "REJECTED" && !value.note) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "Say why this document could not be accepted.",
      });
    }
  });

export const supplierSuspensionSchema = z
  .object({
    supplierId: uuidSchema,
    suspend: z.enum(["true", "false"]),
    reason: optionalText(400),
  })
  .superRefine((value, ctx) => {
    if (value.suspend === "true" && !value.reason) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Say why trading is being suspended.",
      });
    }
  });

export const supplierCommercialsSchema = z.object({
  supplierId: uuidSchema,
  subscriptionTier: z.enum(["FREE", "STANDARD", "PREMIUM"]),
  /** Blank means "use the platform default". */
  commissionRateBps: z
    .string()
    .transform((value) => value.trim())
    .transform((value, ctx) => {
      if (value === "") return null;
      const parsed = nonNegativeIntSchema("Commission rate", 5_000).safeParse(value);
      if (!parsed.success) {
        ctx.addIssue({ code: "custom", message: "Enter a rate in basis points, for example 350." });
        return z.NEVER;
      }
      return parsed.data;
    }),
});

export const productModerationSchema = z
  .object({
    productId: uuidSchema,
    decision: z.enum(["APPROVE", "REJECT"]),
    reason: optionalText(400),
  })
  .superRefine((value, ctx) => {
    if (value.decision === "REJECT" && !value.reason) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Tell the supplier what to change.",
      });
    }
  });

/** A customer or supplier escalating an order to BuildLink. */
export const raiseDisputeSchema = z.object({
  orderId: uuidSchema,
  reason: z.enum(DISPUTE_REASONS),
  description: requiredText("Description", 2000, 20),
});

export const disputeDecisionSchema = z
  .object({
    disputeId: uuidSchema,
    status: z.enum(["UNDER_REVIEW", "RESOLVED", "CLOSED"]),
    resolution: optionalText(2000),
  })
  .superRefine((value, ctx) => {
    if (value.status !== "UNDER_REVIEW" && !value.resolution) {
      ctx.addIssue({
        code: "custom",
        path: ["resolution"],
        message: "Record what was decided. Both parties are shown this.",
      });
    }
  });

export const reviewModerationSchema = z
  .object({
    reviewId: uuidSchema,
    action: z.enum(["HIDE", "PUBLISH", "ALLOW_AMENDMENT"]),
    reason: optionalText(400),
  })
  .superRefine((value, ctx) => {
    if (value.action === "HIDE" && !value.reason) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Hiding a review needs a reason on the record.",
      });
    }
  });

/**
 * Platform settings.
 *
 * Values arrive from the form keyed by setting name and are converted according
 * to the kind each key declares, so a percentage typed as "3.5" cannot be stored
 * where basis points are expected.
 */
export const platformSettingsSchema = z.object({
  "commission.enabled": z
    .union([z.literal("on"), z.literal(""), z.undefined()])
    .transform((value) => value === "on"),
  "commission.default_rate_bps": nonNegativeIntSchema("Commission rate", 5_000),
  "subscription.standard_price_minor": zmwAmountSchema("Standard subscription price"),
  "subscription.premium_price_minor": zmwAmountSchema("Premium subscription price"),
  "budget.alert_threshold_percent": nonNegativeIntSchema("Budget alert threshold", 100),
  "orders.auto_complete_after_days": nonNegativeIntSchema("Auto-complete window", 365),
});

/**
 * Compile-time proof that the settings form covers every configurable key:
 * adding a key to `PLATFORM_SETTING_DEFAULTS` without a control here fails the
 * type check rather than silently becoming uneditable.
 */
type AssertNever<T extends never> = T;
type _AllSettingsHaveAControl = AssertNever<
  Exclude<PlatformSettingKey, keyof z.infer<typeof platformSettingsSchema>>
>;
