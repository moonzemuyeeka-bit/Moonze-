import "server-only";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AuthenticationError, AuthorisationError, NotFoundError } from "@/lib/errors";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { isAdminRole, roleHasPermission, type Permission } from "@/lib/auth/permissions";

/**
 * Server-side authorisation guards.
 *
 * Two flavours, deliberately:
 *  * `require*` throws an `AppError` — for server actions and route handlers,
 *    where the caller turns the error into a field-level message.
 *  * `requirePage*` redirects — for server components, where a redirect is the
 *    correct user experience.
 *
 * Both consult the database-backed session on every request, so authorisation
 * is never decided by client-supplied data.
 */

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthenticationError();
  return user;
}

/** Suspended accounts may read, but never write. */
export async function requireActiveUser(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.status === "SUSPENDED") {
    throw new AuthorisationError(
      "Your account is suspended. Contact BuildLink support to restore access.",
    );
  }
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireActiveUser();
  if (!roleHasPermission(user.role, permission)) {
    throw new AuthorisationError();
  }
  return user;
}

export async function requirePageUser(returnTo?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
  }
  return user;
}

export async function requirePagePermission(
  permission: Permission,
  returnTo?: string,
): Promise<SessionUser> {
  const user = await requirePageUser(returnTo);
  if (!roleHasPermission(user.role, permission)) {
    redirect("/no-access");
  }
  return user;
}

export type SupplierContext = {
  user: SessionUser;
  supplier: {
    id: string;
    businessName: string;
    slug: string;
    verificationStatus: string;
    isSuspended: boolean;
    provinceId: string;
    districtId: string | null;
    deliveryAvailable: boolean;
    minimumOrderMinor: number;
  };
};

/**
 * Resolves the supplier business owned by the signed-in user. A SUPPLIER
 * account without a profile has not finished onboarding, so we send them there
 * rather than showing an empty console.
 */
export async function requirePageSupplier(returnTo?: string): Promise<SupplierContext> {
  const user = await requirePagePermission("supplier:manage_own_profile", returnTo);
  const supplier = await db.supplierProfile.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: {
      id: true,
      businessName: true,
      slug: true,
      verificationStatus: true,
      isSuspended: true,
      provinceId: true,
      districtId: true,
      deliveryAvailable: true,
      minimumOrderMinor: true,
    },
  });

  if (!supplier) {
    redirect("/suppliers/apply");
  }

  return { user, supplier };
}

export async function requireSupplier(): Promise<SupplierContext> {
  const user = await requirePermission("supplier:manage_own_profile");
  const supplier = await db.supplierProfile.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: {
      id: true,
      businessName: true,
      slug: true,
      verificationStatus: true,
      isSuspended: true,
      provinceId: true,
      districtId: true,
      deliveryAvailable: true,
      minimumOrderMinor: true,
    },
  });

  if (!supplier) {
    throw new NotFoundError("supplier business");
  }
  if (supplier.isSuspended) {
    throw new AuthorisationError(
      "This business is suspended and cannot trade. Contact BuildLink support.",
    );
  }

  return { user, supplier };
}

/**
 * Page equivalent of `requireDeliveryProvider`. A DELIVERY_PROVIDER account
 * without a transport profile has not finished signing up, so it is sent back to
 * the registration form rather than shown an empty job board.
 */
export async function requirePageDeliveryProvider(returnTo?: string): Promise<{
  user: SessionUser;
  providerId: string;
}> {
  const user = await requirePagePermission("delivery:manage_own_jobs", returnTo);
  const provider = await db.deliveryProvider.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!provider) {
    redirect("/register/delivery");
  }
  return { user, providerId: provider.id };
}

export async function requireDeliveryProvider(): Promise<{
  user: SessionUser;
  providerId: string;
}> {
  const user = await requirePermission("delivery:manage_own_jobs");
  const provider = await db.deliveryProvider.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!provider) throw new NotFoundError("delivery provider profile");
  return { user, providerId: provider.id };
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireActiveUser();
  if (!isAdminRole(user.role)) throw new AuthorisationError();
  return user;
}

export async function requirePageAdmin(returnTo?: string): Promise<SessionUser> {
  const user = await requirePageUser(returnTo);
  if (!isAdminRole(user.role)) redirect("/no-access");
  return user;
}

/**
 * Confirms the signed-in customer owns a project before any read or write.
 * Admins are allowed through for support purposes, which the audit log records.
 */
export async function assertProjectAccess(projectId: string, user: SessionUser): Promise<void> {
  const project = await db.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { customerId: true },
  });
  if (!project) throw new NotFoundError("project");
  if (project.customerId !== user.id && !isAdminRole(user.role)) {
    throw new AuthorisationError();
  }
}
