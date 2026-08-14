"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  destroyAllSessionsForUser,
  destroyCurrentSession,
  clientIpFrom,
} from "@/lib/auth/session";
import { requireActiveUser } from "@/lib/auth/guards";
import { ROLE_HOME_PATH } from "@/lib/auth/permissions";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/rate-limit";
import { track, ANALYTICS_EVENTS } from "@/lib/services/analytics";
import { notify } from "@/lib/services/notifications";
import {
  actionFailure,
  actionSuccess,
  ConflictError,
  toActionError,
  ValidationError,
  type ActionResult,
} from "@/lib/errors";
import {
  changePasswordSchema,
  loginSchema,
  registerCustomerSchema,
  registerDeliveryProviderSchema,
  registerSupplierSchema,
  updateProfileSchema,
} from "@/lib/validation/auth";
import { fieldErrorsFrom, formDataList, formDataToObject } from "@/lib/validation/shared";
import { slugify } from "@/lib/utils";

/**
 * Authentication server actions.
 *
 * Every action re-validates on the server, rate-limits by IP, and returns a
 * discriminated `ActionResult` the form renders inline. Successful sign-in and
 * registration redirect, so the browser never sits on a POST result.
 */

export type AuthActionState = ActionResult<{ redirectTo: string }> | null;

const FAILED_LOGIN_LOCK_THRESHOLD = 10;
const LOCK_DURATION_MINUTES = 15;

async function requestIp(): Promise<string> {
  const requestHeaders = await headers();
  return clientIpFrom(requestHeaders) ?? "unknown";
}

/** Safe post-login destination: only same-site absolute paths are accepted. */
function safeRedirect(next: string | null | undefined, fallback: string): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

export async function loginAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  let destination: string;

  try {
    const parsed = loginSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check your email and password.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }

    const ip = await requestIp();
    await enforceRateLimit("login", ip);

    const user = await db.user.findUnique({
      where: { email: parsed.data.email },
      select: {
        id: true,
        passwordHash: true,
        role: true,
        status: true,
        failedLogins: true,
        lockedUntil: true,
        deletedAt: true,
      },
    });

    // The same message covers "no such account" and "wrong password" so the
    // form cannot be used to enumerate which emails are registered.
    const invalidCredentials = actionFailure(
      "That email and password combination did not work.",
      "INVALID_CREDENTIALS",
    );

    if (!user || user.deletedAt !== null) {
      // Spend comparable time on a missing account so response timing does not
      // reveal whether the email exists.
      await verifyPassword(parsed.data.password, "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu");
      return invalidCredentials;
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      return actionFailure(
        `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}, or reset your password.`,
        "ACCOUNT_LOCKED",
      );
    }

    const passwordMatches = await verifyPassword(parsed.data.password, user.passwordHash);

    if (!passwordMatches) {
      const failedLogins = user.failedLogins + 1;
      await db.user.update({
        where: { id: user.id },
        data: {
          failedLogins,
          lockedUntil:
            failedLogins >= FAILED_LOGIN_LOCK_THRESHOLD
              ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60_000)
              : null,
        },
      });
      return invalidCredentials;
    }

    if (user.status === "DEACTIVATED") {
      return actionFailure(
        "This account has been closed. Contact BuildLink support if you need it reopened.",
        "ACCOUNT_CLOSED",
      );
    }

    await db.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    await createSession(user.id);
    await recordAudit({
      action: AUDIT_ACTIONS.userSignedIn,
      resourceType: "user",
      resourceId: user.id,
      actorUserId: user.id,
      actorRole: user.role,
    });
    await track({ name: ANALYTICS_EVENTS.userSignedIn, userId: user.id, properties: { role: user.role } });

    destination = safeRedirect(parsed.data.next ?? null, ROLE_HOME_PATH[user.role]);
  } catch (error) {
    return toActionError(error, "loginAction");
  }

  redirect(destination);
}

export async function registerCustomerAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  let destination: string;

  try {
    const parsed = registerCustomerSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check the highlighted fields.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }

    await enforceRateLimit("register", await requestIp());

    const existing = await db.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if (existing) {
      throw new ValidationError("That email already has a BuildLink account.", {
        email: ["An account with this email already exists. Try signing in instead."],
      });
    }

    if (parsed.data.phone) {
      const phoneTaken = await db.user.findUnique({
        where: { phone: parsed.data.phone },
        select: { id: true },
      });
      if (phoneTaken) {
        throw new ValidationError("That mobile number is already in use.", {
          phone: ["This number is already linked to another account."],
        });
      }
    }

    const passwordHash = await hashPassword(parsed.data.password);

    const user = await db.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        passwordHash,
        role: "CUSTOMER",
        status: "ACTIVE",
        customerProfile: { create: { phone: parsed.data.phone } },
      },
      select: { id: true, role: true },
    });

    await createSession(user.id);
    await recordAudit({
      action: AUDIT_ACTIONS.userRegistered,
      resourceType: "user",
      resourceId: user.id,
      actorUserId: user.id,
      actorRole: user.role,
      newValue: { role: "CUSTOMER" },
    });
    await track({
      name: ANALYTICS_EVENTS.userRegistered,
      userId: user.id,
      properties: { role: "CUSTOMER" },
    });
    await notify({
      userId: user.id,
      type: "PROJECT_BUDGET_ALERT",
      title: "Welcome to BuildLink Zambia",
      body: "Set up your first project to start tracking your budget, orders and deliveries in one place.",
      linkUrl: "/customer/onboarding",
    });

    destination = safeRedirect(parsed.data.next ?? null, "/customer/onboarding");
  } catch (error) {
    return toActionError(error, "registerCustomerAction");
  }

  redirect(destination);
}

export async function registerSupplierAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  let destination: string;

  try {
    const raw = {
      ...formDataToObject(formData),
      categoryIds: formDataList(formData, "categoryIds"),
    };
    const parsed = registerSupplierSchema.safeParse(raw);
    if (!parsed.success) {
      return actionFailure(
        "Please check the highlighted fields.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }

    await enforceRateLimit("register", await requestIp());

    const existing = await db.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if (existing) {
      throw new ValidationError("That email already has a BuildLink account.", {
        email: ["An account with this email already exists. Sign in and add your business instead."],
      });
    }

    const province = await db.province.findUnique({
      where: { id: parsed.data.provinceId },
      select: { id: true },
    });
    if (!province) {
      throw new ValidationError("Choose a province.", { provinceId: ["Select a province."] });
    }

    const categories = await db.productCategory.findMany({
      where: { id: { in: parsed.data.categoryIds }, parentId: null },
      select: { id: true },
    });
    if (categories.length === 0) {
      throw new ValidationError("Choose at least one category.", {
        categoryIds: ["Select the categories your business supplies."],
      });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const slug = await uniqueSupplierSlug(parsed.data.businessName);

    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: parsed.data.contactName,
          email: parsed.data.email,
          phone: parsed.data.phone,
          passwordHash,
          role: "SUPPLIER",
          status: "ACTIVE",
        },
        select: { id: true, role: true },
      });

      const supplier = await tx.supplierProfile.create({
        data: {
          userId: created.id,
          businessName: parsed.data.businessName,
          slug,
          description: parsed.data.description ?? null,
          phone: parsed.data.phone,
          email: parsed.data.email,
          provinceId: parsed.data.provinceId,
          districtId: parsed.data.districtId ?? null,
          address: parsed.data.address ?? null,
          yearsOperating: parsed.data.yearsOperating ?? null,
          registrationNumber: parsed.data.registrationNumber ?? null,
          taxpayerNumber: parsed.data.taxpayerNumber ?? null,
          businessRegistrationStatus: parsed.data.registrationNumber
            ? "SELF_DECLARED"
            : "NOT_PROVIDED",
          verificationStatus: "PENDING",
          deliveryAvailable: parsed.data.deliveryAvailable,
          categories: { connect: categories.map((category) => ({ id: category.id })) },
        },
        select: { id: true },
      });

      await tx.supplierVerification.create({
        data: { supplierId: supplier.id, status: "PENDING" },
      });

      await recordAudit(
        {
          action: AUDIT_ACTIONS.supplierApplied,
          resourceType: "supplier",
          resourceId: supplier.id,
          actorUserId: created.id,
          actorRole: "SUPPLIER",
          newValue: { businessName: parsed.data.businessName, verificationStatus: "PENDING" },
        },
        tx,
      );

      return created;
    });

    await createSession(user.id);
    await track({
      name: ANALYTICS_EVENTS.supplierApplied,
      userId: user.id,
      properties: { categories: categories.length },
    });
    await notify({
      userId: user.id,
      type: "SUPPLIER_VERIFICATION_UPDATE",
      title: "Business registered — verification pending",
      body:
        "Your business is live on BuildLink as pending verification. Upload your registration documents " +
        "so our team can verify you, and start adding products now.",
      linkUrl: "/supplier/verification",
    });

    destination = "/supplier/dashboard";
  } catch (error) {
    return toActionError(error, "registerSupplierAction");
  }

  redirect(destination);
}

export async function registerDeliveryProviderAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  let destination: string;

  try {
    const parsed = registerDeliveryProviderSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check the highlighted fields.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }

    await enforceRateLimit("register", await requestIp());

    const existing = await db.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if (existing) {
      throw new ValidationError("That email already has a BuildLink account.", {
        email: ["An account with this email already exists."],
      });
    }

    const passwordHash = await hashPassword(parsed.data.password);

    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: parsed.data.contactName,
          email: parsed.data.email,
          phone: parsed.data.phone,
          passwordHash,
          role: "DELIVERY_PROVIDER",
          status: "ACTIVE",
        },
        select: { id: true },
      });

      const provider = await tx.deliveryProvider.create({
        data: {
          userId: created.id,
          businessName: parsed.data.businessName,
          type: parsed.data.type,
          phone: parsed.data.phone,
          description: parsed.data.description ?? null,
          verificationStatus: "PENDING",
        },
        select: { id: true },
      });

      await tx.serviceArea.create({
        data: { providerId: provider.id, provinceId: parsed.data.provinceId },
      });

      return created;
    });

    await createSession(user.id);
    await track({ name: ANALYTICS_EVENTS.userRegistered, userId: user.id, properties: { role: "DELIVERY_PROVIDER" } });

    destination = "/delivery";
  } catch (error) {
    return toActionError(error, "registerDeliveryProviderAction");
  }

  redirect(destination);
}

export async function logoutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect("/");
}

export async function changePasswordAction(
  _previous: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireActiveUser();
    const parsed = changePasswordSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check the highlighted fields.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }

    const record = await db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    if (!(await verifyPassword(parsed.data.currentPassword, record.passwordHash))) {
      return actionFailure("Your current password is not correct.", "VALIDATION_ERROR", {
        currentPassword: ["Incorrect password."],
      });
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await db.user.update({ where: { id: user.id }, data: { passwordHash } });

    // Changing a password signs every other device out, then re-establishes this
    // one — the expected behaviour after a possible compromise.
    await destroyAllSessionsForUser(user.id);
    await createSession(user.id);

    revalidatePath("/account");
    return actionSuccess();
  } catch (error) {
    return toActionError(error, "changePasswordAction");
  }
}

export async function updateProfileAction(
  _previous: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  try {
    const user = await requireActiveUser();
    const parsed = updateProfileSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return actionFailure(
        "Please check the highlighted fields.",
        "VALIDATION_ERROR",
        fieldErrorsFrom(parsed.error),
      );
    }

    if (parsed.data.phone) {
      const taken = await db.user.findFirst({
        where: { phone: parsed.data.phone, id: { not: user.id } },
        select: { id: true },
      });
      if (taken) {
        return actionFailure("That mobile number is already in use.", "CONFLICT", {
          phone: ["This number is already linked to another account."],
        });
      }
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone,
        // A changed number must be re-verified once OTP delivery is enabled.
        phoneVerifiedAt: parsed.data.phone === user.phone ? undefined : null,
      },
    });

    revalidatePath("/account");
    return actionSuccess();
  } catch (error) {
    return toActionError(error, "updateProfileAction");
  }
}

/** Ensures the public supplier slug is unique, appending a counter if needed. */
async function uniqueSupplierSlug(businessName: string): Promise<string> {
  const base = slugify(businessName);
  let candidate = base;
  let counter = 2;

  for (;;) {
    const clash = await db.supplierProfile.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
    candidate = `${base}-${counter}`;
    counter += 1;
    if (counter > 50) throw new ConflictError("Could not create a unique web address for that business name.");
  }
}
