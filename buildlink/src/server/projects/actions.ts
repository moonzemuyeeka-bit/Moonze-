"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { AUDIT_ACTIONS, auditSnapshot, recordAudit } from "@/lib/audit";
import { ANALYTICS_EVENTS, track } from "@/lib/services/analytics";
import { notify } from "@/lib/services/notifications";
import { BUDGET_CATEGORY_KEYS, BUDGET_CATEGORY_LABELS, STAGE_PROGRESS_PERCENT } from "@/lib/labels";
import { suggestBudgetAllocation, BUDGET_WARNING_THRESHOLD_PERCENT } from "@/lib/domain/budget";
import { formatZmw } from "@/lib/money";
import {
  actionFailure,
  actionSuccess,
  NotFoundError,
  toActionError,
  ValidationError,
  type ActionResult,
} from "@/lib/errors";
import { fieldErrorsFrom, formDataToObject } from "@/lib/validation/shared";
import {
  advanceStageSchema,
  budgetAllocationSchema,
  budgetTransactionSchema,
  deleteProjectSchema,
  onboardingSchema,
  projectSchema,
  walletEntrySchema,
} from "@/lib/validation/project";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Project and budget mutations.
 *
 * Every action re-checks the permission and the ownership of the project it
 * touches: a project id in a form field is untrusted input. Creating a project
 * also creates its budget and the 16 categories in one transaction, so a
 * customer never lands on a half-built budget screen.
 */

export type ProjectActionState = ActionResult<{ projectId: string }> | null;

async function requireOwnedProject(
  projectId: string,
  user: SessionUser,
): Promise<{ id: string; name: string; estimatedBudgetMinor: number; budgetId: string | null }> {
  const project = await db.project.findFirst({
    where: { id: projectId, customerId: user.id, deletedAt: null },
    select: {
      id: true,
      name: true,
      estimatedBudgetMinor: true,
      budget: { select: { id: true } },
    },
  });
  if (!project) throw new NotFoundError("project");
  return {
    id: project.id,
    name: project.name,
    estimatedBudgetMinor: project.estimatedBudgetMinor,
    budgetId: project.budget?.id ?? null,
  };
}

/** Creates the budget shell and its 16 categories, pre-filled from the template. */
async function createBudget(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  input: {
    projectId: string;
    estimatedBudgetMinor: number;
    propertyType: Parameters<typeof suggestBudgetAllocation>[1];
  },
): Promise<void> {
  const budget = await tx.projectBudget.create({
    data: { projectId: input.projectId },
    select: { id: true },
  });

  await tx.budgetCategory.createMany({
    data: suggestBudgetAllocation(input.estimatedBudgetMinor, input.propertyType).map(
      (allocation) => ({
        budgetId: budget.id,
        key: allocation.key,
        plannedMinor: allocation.plannedMinor,
        sortOrder: allocation.sortOrder,
      }),
    ),
  });
}

export async function completeOnboardingAction(
  _previous: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  let destination: string;

  try {
    const user = await requirePermission("project:manage");
    const parsed = onboardingSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check the highlighted answers.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }

    const input = parsed.data;
    await assertLocation(input.provinceId, input.districtId);

    const projectId = await db.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          customerId: user.id,
          name: input.projectName,
          propertyType: input.propertyType,
          constructionType: input.constructionType,
          provinceId: input.provinceId,
          districtId: input.districtId ?? null,
          locationDetail: input.locationDetail ?? null,
          bedrooms: input.bedrooms,
          approximateSizeSqm: input.approximateSizeSqm,
          stage: input.stage,
          status: input.stage === "PLANNING" ? "PLANNING" : "ACTIVE",
          estimatedBudgetMinor: input.estimatedBudget,
          description: input.description ?? null,
          targetCompletionDate: input.targetCompletionDate,
          progressPercent: STAGE_PROGRESS_PERCENT[input.stage],
        },
        select: { id: true },
      });

      await createBudget(tx, {
        projectId: project.id,
        estimatedBudgetMinor: input.estimatedBudget,
        propertyType: input.propertyType,
      });

      await tx.customerProfile.upsert({
        where: { userId: user.id },
        update: {
          provinceId: input.provinceId,
          districtId: input.districtId ?? null,
          buildingIntent: input.propertyType,
          currentStage: input.stage,
          onboardingCompletedAt: new Date(),
        },
        create: {
          userId: user.id,
          provinceId: input.provinceId,
          districtId: input.districtId ?? null,
          buildingIntent: input.propertyType,
          currentStage: input.stage,
          onboardingCompletedAt: new Date(),
        },
      });

      return project.id;
    });

    await track({
      name: ANALYTICS_EVENTS.onboardingCompleted,
      userId: user.id,
      properties: { propertyType: input.propertyType, stage: input.stage },
    });
    await track({
      name: ANALYTICS_EVENTS.projectCreated,
      userId: user.id,
      properties: { propertyType: input.propertyType, source: "onboarding" },
    });

    destination = `/customer/projects/${projectId}`;
  } catch (error) {
    return toActionError(error, "completeOnboardingAction");
  }

  redirect(destination);
}

export async function createProjectAction(
  _previous: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  let destination: string;

  try {
    const user = await requirePermission("project:manage");
    const parsed = projectSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check the highlighted fields.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }

    const input = parsed.data;
    await assertLocation(input.provinceId, input.districtId);

    const projectId = await db.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          customerId: user.id,
          name: input.name,
          propertyType: input.propertyType,
          constructionType: input.constructionType,
          provinceId: input.provinceId,
          districtId: input.districtId ?? null,
          locationDetail: input.locationDetail ?? null,
          bedrooms: input.bedrooms,
          approximateSizeSqm: input.approximateSizeSqm,
          stage: input.stage,
          status: input.status,
          estimatedBudgetMinor: input.estimatedBudget,
          description: input.description ?? null,
          startDate: input.startDate,
          targetCompletionDate: input.targetCompletionDate,
          progressPercent: input.progressPercent,
        },
        select: { id: true },
      });

      await createBudget(tx, {
        projectId: project.id,
        estimatedBudgetMinor: input.estimatedBudget,
        propertyType: input.propertyType,
      });

      return project.id;
    });

    await track({
      name: ANALYTICS_EVENTS.projectCreated,
      userId: user.id,
      properties: { propertyType: input.propertyType, source: "manual" },
    });

    revalidatePath("/customer/projects");
    revalidatePath("/customer/dashboard");
    destination = `/customer/projects/${projectId}`;
  } catch (error) {
    return toActionError(error, "createProjectAction");
  }

  redirect(destination);
}

export async function updateProjectAction(
  _previous: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  try {
    const user = await requirePermission("project:manage");
    const projectId = String(formData.get("projectId") ?? "");
    const existing = await requireOwnedProject(projectId, user);

    const parsed = projectSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check the highlighted fields.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }

    const input = parsed.data;
    await assertLocation(input.provinceId, input.districtId);

    await db.project.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        propertyType: input.propertyType,
        constructionType: input.constructionType,
        provinceId: input.provinceId,
        districtId: input.districtId ?? null,
        locationDetail: input.locationDetail ?? null,
        bedrooms: input.bedrooms,
        approximateSizeSqm: input.approximateSizeSqm,
        stage: input.stage,
        status: input.status,
        estimatedBudgetMinor: input.estimatedBudget,
        description: input.description ?? null,
        startDate: input.startDate,
        targetCompletionDate: input.targetCompletionDate,
        progressPercent: input.progressPercent,
      },
    });

    revalidatePath(`/customer/projects/${existing.id}`);
    revalidatePath("/customer/projects");
    revalidatePath("/customer/dashboard");
    return actionSuccess({ projectId: existing.id });
  } catch (error) {
    return toActionError(error, "updateProjectAction");
  }
}

/** One-tap stage advance from the project page. */
export async function advanceProjectStageAction(
  _previous: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  try {
    const user = await requirePermission("project:manage");
    const parsed = advanceStageSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "That stage is not valid.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }

    const project = await requireOwnedProject(parsed.data.projectId, user);

    await db.project.update({
      where: { id: project.id },
      data: {
        stage: parsed.data.stage,
        progressPercent: parsed.data.progressPercent,
        status: parsed.data.stage === "COMPLETED" ? "COMPLETED" : "ACTIVE",
      },
    });

    await db.customerProfile.updateMany({
      where: { userId: user.id },
      data: { currentStage: parsed.data.stage },
    });

    await track({
      name: ANALYTICS_EVENTS.projectStageAdvanced,
      userId: user.id,
      properties: { stage: parsed.data.stage },
    });

    revalidatePath(`/customer/projects/${project.id}`);
    revalidatePath("/customer/dashboard");
    return actionSuccess({ projectId: project.id });
  } catch (error) {
    return toActionError(error, "advanceProjectStageAction");
  }
}

/**
 * Soft delete. Orders, payments and agreements reference the project, so the row
 * stays and is hidden — a customer's purchase history must remain intact.
 */
export async function deleteProjectAction(
  _previous: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  let deleted = false;

  try {
    const user = await requirePermission("project:manage");
    const parsed = deleteProjectSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Type the project name exactly to confirm.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }

    const project = await requireOwnedProject(parsed.data.projectId, user);

    if (parsed.data.confirmName.trim() !== project.name) {
      return actionFailure("The name you typed does not match this project.", "VALIDATION_ERROR", {
        confirmName: ["Type the project name exactly as it appears."],
      });
    }

    await db.project.update({
      where: { id: project.id },
      data: { deletedAt: new Date(), status: "CANCELLED" },
    });

    revalidatePath("/customer/projects");
    revalidatePath("/customer/dashboard");
    deleted = true;
  } catch (error) {
    return toActionError(error, "deleteProjectAction");
  }

  if (deleted) redirect("/customer/projects");
  return actionSuccess();
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

export async function updateBudgetAllocationsAction(
  _previous: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  try {
    const user = await requirePermission("project:manage");

    const projectId = String(formData.get("projectId") ?? "");
    const allocations = BUDGET_CATEGORY_KEYS.map((key) => ({
      key,
      plannedMinor: formData.get(`planned.${key}`) ?? "0",
    }));

    const parsed = budgetAllocationSchema.safeParse({ projectId, allocations });
    if (!parsed.success) {
      return actionFailure(
        "Please check the highlighted amounts.",
        "VALIDATION_ERROR",
        renameAllocationErrors(fieldErrorsFrom(parsed.error), allocations.length),
      );
    }

    const project = await requireOwnedProject(parsed.data.projectId, user);
    if (!project.budgetId) throw new NotFoundError("budget");

    await db.$transaction(async (tx) => {
      for (const allocation of parsed.data.allocations) {
        await tx.budgetCategory.upsert({
          where: { budgetId_key: { budgetId: project.budgetId as string, key: allocation.key } },
          update: { plannedMinor: allocation.plannedMinor },
          create: {
            budgetId: project.budgetId as string,
            key: allocation.key,
            plannedMinor: allocation.plannedMinor,
            sortOrder: BUDGET_CATEGORY_KEYS.indexOf(allocation.key),
          },
        });
      }
    });

    await track({ name: ANALYTICS_EVENTS.budgetUpdated, userId: user.id });

    revalidatePath(`/customer/projects/${project.id}/budget`);
    revalidatePath("/customer/budget");
    return actionSuccess();
  } catch (error) {
    return toActionError(error, "updateBudgetAllocationsAction");
  }
}

/** Zod reports `allocations.3.plannedMinor`; forms address `planned.ROOFING`. */
function renameAllocationErrors(
  fieldErrors: Record<string, string[]>,
  _count: number,
): Record<string, string[]> {
  const renamed: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(fieldErrors)) {
    const match = /^allocations\.(\d+)\./.exec(key);
    if (match?.[1]) {
      const categoryKey = BUDGET_CATEGORY_KEYS[Number(match[1])];
      renamed[categoryKey ? `planned.${categoryKey}` : key] = messages;
    } else {
      renamed[key] = messages;
    }
  }
  return renamed;
}

export async function addBudgetTransactionAction(
  _previous: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  try {
    const user = await requirePermission("project:manage");
    const parsed = budgetTransactionSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check the highlighted fields.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }

    const project = await requireOwnedProject(parsed.data.projectId, user);

    if (parsed.data.categoryId) {
      const category = await db.budgetCategory.findFirst({
        where: { id: parsed.data.categoryId, budget: { projectId: project.id } },
        select: { id: true },
      });
      if (!category) {
        return actionFailure("Choose a budget category from the list.", "VALIDATION_ERROR", {
          categoryId: ["That category does not belong to this project."],
        });
      }
    }

    await db.budgetTransaction.create({
      data: {
        projectId: project.id,
        categoryId: parsed.data.categoryId ?? null,
        type: parsed.data.type,
        amountMinor: parsed.data.amount,
        description: parsed.data.description,
        occurredAt: parsed.data.occurredAt ?? new Date(),
        createdById: user.id,
      },
    });

    await warnIfCategoryOverspent(project.id, user, parsed.data.categoryId ?? null);

    revalidatePath(`/customer/projects/${project.id}/budget`);
    revalidatePath(`/customer/projects/${project.id}`);
    revalidatePath("/customer/budget");
    revalidatePath("/customer/dashboard");
    return actionSuccess();
  } catch (error) {
    return toActionError(error, "addBudgetTransactionAction");
  }
}

/**
 * Notifies the customer when a category passes the warning threshold. Finding
 * out you are over budget on roofing while you can still change the plan is the
 * whole point of tracking it.
 */
async function warnIfCategoryOverspent(
  projectId: string,
  user: SessionUser,
  categoryId: string | null,
): Promise<void> {
  if (!categoryId) return;

  const category = await db.budgetCategory.findUnique({
    where: { id: categoryId },
    select: {
      key: true,
      plannedMinor: true,
      transactions: { select: { amountMinor: true, type: true } },
    },
  });
  if (!category || category.plannedMinor <= 0) return;

  const spent = category.transactions
    .filter((transaction) => transaction.type !== "DEPOSIT" && transaction.type !== "REFUND")
    .reduce((total, transaction) => total + transaction.amountMinor, 0);

  const percent = Math.round((spent / category.plannedMinor) * 100);
  if (percent < BUDGET_WARNING_THRESHOLD_PERCENT) return;

  const label = BUDGET_CATEGORY_LABELS[category.key];
  await notify({
    userId: user.id,
    type: "PROJECT_BUDGET_ALERT",
    title:
      percent > 100
        ? `${label} is over budget`
        : `${label} has used ${percent}% of its budget`,
    body:
      `You have booked ${formatZmw(spent)} against a plan of ${formatZmw(category.plannedMinor)} for ${label}. ` +
      "Review the category and move funds if you need to.",
    linkUrl: `/customer/projects/${projectId}/budget`,
  });
}

export async function recordWalletEntryAction(
  _previous: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  try {
    const user = await requirePermission("wallet:manage");
    const parsed = walletEntrySchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check the highlighted fields.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }

    const project = await requireOwnedProject(parsed.data.projectId, user);

    await db.$transaction(async (tx) => {
      await tx.walletEntry.create({
        data: {
          projectId: project.id,
          type: parsed.data.type,
          amountMinor: parsed.data.amount,
          description: parsed.data.description,
          reference: parsed.data.reference ?? null,
          createdById: user.id,
        },
      });

      await recordAudit(
        {
          action: AUDIT_ACTIONS.walletDepositRecorded,
          resourceType: "project_wallet",
          resourceId: project.id,
          actorUserId: user.id,
          actorRole: user.role,
          newValue: auditSnapshot(parsed.data, ["type", "amount", "description"]),
        },
        tx,
      );
    });

    revalidatePath(`/customer/projects/${project.id}/budget`);
    revalidatePath("/customer/budget");
    revalidatePath("/customer/dashboard");
    return actionSuccess();
  } catch (error) {
    return toActionError(error, "recordWalletEntryAction");
  }
}

/** Province and district must exist and belong together. */
async function assertLocation(provinceId: string, districtId: string | null | undefined) {
  const province = await db.province.findUnique({
    where: { id: provinceId },
    select: { id: true },
  });
  if (!province) {
    throw new ValidationError("Choose a province.", { provinceId: ["Select a province."] });
  }

  if (districtId) {
    const district = await db.district.findFirst({
      where: { id: districtId, provinceId },
      select: { id: true },
    });
    if (!district) {
      throw new ValidationError("Choose a district in that province.", {
        districtId: ["That district is not in the selected province."],
      });
    }
  }
}
