import { z } from "zod";
import {
  nonNegativeIntSchema,
  optionalDateSchema,
  optionalText,
  requiredText,
  uuidSchema,
  zmwAmountSchema,
} from "@/lib/validation/shared";
import { BUDGET_CATEGORY_KEYS, CONSTRUCTION_STAGES, CONSTRUCTION_TYPES, PROJECT_STATUSES, PROPERTY_TYPES } from "@/lib/labels";

/**
 * Project, budget and wallet input schemas.
 *
 * Enum values are validated against the label lists rather than re-declared, so
 * a schema change in Prisma that adds a stage cannot silently bypass validation.
 */

export const propertyTypeSchema = z.enum(PROPERTY_TYPES);
export const constructionTypeSchema = z.enum(CONSTRUCTION_TYPES);
export const constructionStageSchema = z.enum(CONSTRUCTION_STAGES);
export const projectStatusSchema = z.enum(PROJECT_STATUSES);
export const budgetCategoryKeySchema = z.enum(BUDGET_CATEGORY_KEYS);

const optionalUuid = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional()
  .superRefine((value, ctx) => {
    if (value !== null && value !== undefined && !z.uuid().safeParse(value).success) {
      ctx.addIssue({ code: "custom", message: "That selection is not valid." });
    }
  });

const optionalPositiveInt = (label: string, max: number) =>
  z
    .union([z.string(), z.number()])
    .transform((value) => (typeof value === "string" && value.trim() === "" ? null : value))
    .nullable()
    .optional()
    .transform((value, ctx) => {
      if (value === null || value === undefined) return null;
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
        ctx.addIssue({ code: "custom", message: `${label} must be a whole number up to ${max}.` });
        return z.NEVER;
      }
      return parsed;
    });

/**
 * Onboarding: the four questions that turn a new account into a usable
 * dashboard. Everything optional here can be filled in later from the project
 * screen, so nobody is blocked at signup.
 */
export const onboardingSchema = z.object({
  propertyType: propertyTypeSchema,
  constructionType: constructionTypeSchema,
  projectName: requiredText("Project name", 120),
  provinceId: uuidSchema,
  districtId: optionalUuid,
  locationDetail: optionalText(200),
  bedrooms: optionalPositiveInt("Bedrooms", 40),
  approximateSizeSqm: optionalPositiveInt("Approximate size", 100_000),
  estimatedBudget: zmwAmountSchema("Budget", { min: 1 }),
  stage: constructionStageSchema,
  targetCompletionDate: optionalDateSchema,
  description: optionalText(2000),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const projectSchema = z.object({
  name: requiredText("Project name", 120),
  propertyType: propertyTypeSchema,
  constructionType: constructionTypeSchema,
  provinceId: uuidSchema,
  districtId: optionalUuid,
  locationDetail: optionalText(200),
  bedrooms: optionalPositiveInt("Bedrooms", 40),
  approximateSizeSqm: optionalPositiveInt("Approximate size", 100_000),
  stage: constructionStageSchema,
  status: projectStatusSchema,
  estimatedBudget: zmwAmountSchema("Budget", { min: 1 }),
  description: optionalText(2000),
  startDate: optionalDateSchema,
  targetCompletionDate: optionalDateSchema,
  progressPercent: nonNegativeIntSchema("Progress", 100),
});

export type ProjectInput = z.infer<typeof projectSchema>;

/** Stage advance keeps its own schema so the one-tap action stays cheap. */
export const advanceStageSchema = z.object({
  projectId: uuidSchema,
  stage: constructionStageSchema,
  progressPercent: nonNegativeIntSchema("Progress", 100),
});

export const budgetAllocationSchema = z.object({
  projectId: uuidSchema,
  allocations: z
    .array(
      z.object({
        key: budgetCategoryKeySchema,
        plannedMinor: zmwAmountSchema("Planned amount"),
      }),
    )
    .min(1, "Provide at least one category amount."),
});

export const budgetTransactionSchema = z.object({
  projectId: uuidSchema,
  categoryId: optionalUuid,
  type: z.enum(["EXPENSE", "MATERIAL_PURCHASE", "REFUND", "ADJUSTMENT"]),
  amount: zmwAmountSchema("Amount", { min: 1 }),
  description: requiredText("Description", 200),
  occurredAt: optionalDateSchema,
});

export const walletEntrySchema = z.object({
  projectId: uuidSchema,
  type: z.enum(["DEPOSIT_RECORDED", "REFUND_RECORDED", "ADJUSTMENT"]),
  amount: zmwAmountSchema("Amount", { min: 1 }),
  description: requiredText("Description", 200),
  reference: optionalText(120),
});

export const deleteProjectSchema = z.object({
  projectId: uuidSchema,
  confirmName: requiredText("Project name", 120),
});
