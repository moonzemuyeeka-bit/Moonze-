import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import type { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { env, isProduction } from "@/lib/env";

/**
 * Session management.
 *
 * A session is an opaque 256-bit random token held in an httpOnly cookie. Only
 * a peppered SHA-256 digest is stored, so a database compromise does not yield
 * replayable sessions. Sessions live in Postgres rather than a signed JWT so a
 * suspended account or a revoked device takes effect immediately.
 */

export const SESSION_COOKIE_NAME = "buildlink_session";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  phone: string | null;
  phoneVerifiedAt: Date | null;
  avatarKey: string | null;
  hasCompletedOnboarding: boolean;
  supplierProfileId: string | null;
  deliveryProviderId: string | null;
};

function digest(token: string): string {
  return createHash("sha256").update(`${token}.${env.AUTH_SECRET}`).digest("hex");
}

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

function expiryFromNow(): Date {
  return new Date(Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Constant-time comparison helper for any place we compare secrets outside
 * bcrypt (OTP codes, webhook signatures).
 */
export function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export async function createSession(userId: string): Promise<void> {
  const token = newToken();
  const requestHeaders = await headers();

  await db.session.create({
    data: {
      userId,
      tokenHash: digest(token),
      expiresAt: expiryFromNow(),
      ipAddress: clientIpFrom(requestHeaders),
      userAgent: requestHeaders.get("user-agent")?.slice(0, 512) ?? null,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    expires: expiryFromNow(),
  });
}

export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await db.session.deleteMany({ where: { tokenHash: digest(token) } });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

/** Signs every device out — used after a password change or suspension. */
export async function destroyAllSessionsForUser(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}

/**
 * Resolves the signed-in user for the current request.
 *
 * Wrapped in React's `cache` so a page that checks permissions in a layout, a
 * page and three components still performs exactly one query per request.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: digest(token) },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          phone: true,
          phoneVerifiedAt: true,
          avatarKey: true,
          deletedAt: true,
          customerProfile: { select: { onboardingCompletedAt: true } },
          supplierProfile: { select: { id: true } },
          deliveryProvider: { select: { id: true } },
        },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  const { user } = session;
  if (user.deletedAt !== null || user.status === "DEACTIVATED") return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    phone: user.phone,
    phoneVerifiedAt: user.phoneVerifiedAt,
    avatarKey: user.avatarKey,
    hasCompletedOnboarding: user.customerProfile?.onboardingCompletedAt != null,
    supplierProfileId: user.supplierProfile?.id ?? null,
    deliveryProviderId: user.deliveryProvider?.id ?? null,
  };
});

/** Removes expired sessions. Safe to call from a cron job or after login. */
export async function pruneExpiredSessions(): Promise<number> {
  const result = await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return result.count;
}

export function clientIpFrom(requestHeaders: Headers): string | null {
  const forwarded = requestHeaders.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return requestHeaders.get("x-real-ip")?.slice(0, 64) ?? null;
}

/** IP + user agent captured alongside contract acceptances and audit entries. */
export async function requestFingerprint(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
}> {
  const requestHeaders = await headers();
  return {
    ipAddress: clientIpFrom(requestHeaders),
    userAgent: requestHeaders.get("user-agent")?.slice(0, 512) ?? null,
  };
}
