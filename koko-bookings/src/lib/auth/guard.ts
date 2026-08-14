import { redirect } from "next/navigation";
import { prisma } from "@/lib/database/client";
import { UnauthorizedError } from "@/lib/errors";
import { readSession, type AdminSession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

/** Server components: send an unauthenticated visitor to the login page. */
export async function requireAdminPage(redirectTo = "/admin"): Promise<AdminSession> {
  const session = await readSession();
  if (!session) redirect(`/admin/login?next=${encodeURIComponent(redirectTo)}`);
  return session;
}

/** Route handlers: refuse the request. */
export async function requireAdminApi(): Promise<AdminSession> {
  const session = await readSession();
  if (!session) throw new UnauthorizedError("Admin sign-in required.");
  return session;
}

export async function authenticateAdmin(
  email: string,
  password: string,
): Promise<{ id: string; email: string; name: string; role: "ADMIN" | "STAFF" }> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  // Hash a throwaway password when the account is unknown so a missing account
  // and a wrong password take a similar amount of time.
  if (!user) {
    await hashPassword(password);
    throw new UnauthorizedError("Those details do not match an admin account.");
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new UnauthorizedError("Those details do not match an admin account.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
