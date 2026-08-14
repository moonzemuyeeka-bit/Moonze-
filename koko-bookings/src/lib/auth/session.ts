import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { UserRole } from "@/generated/prisma";
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS, serverEnv } from "@/lib/config";

/**
 * Stateless admin sessions: a small JSON payload signed with HMAC-SHA256 in an
 * httpOnly cookie. Tampering invalidates the signature, and the expiry is
 * enforced server-side on every read.
 */

export type AdminSession = {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  expiresAt: number; // epoch seconds
};

function sign(payload: string): string {
  return createHmac("sha256", serverEnv().SESSION_SECRET).update(payload).digest("base64url");
}

export function encodeSession(session: AdminSession): string {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string | undefined): AdminSession | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload), "utf8");
  const provided = Buffer.from(signature, "utf8");
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return null;
  }

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as AdminSession;
    if (typeof session.expiresAt !== "number" || session.expiresAt * 1000 < Date.now()) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function createSessionCookie(
  user: { id: string; email: string; name: string; role: UserRole },
): Promise<void> {
  const session: AdminSession = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

export async function readSession(): Promise<AdminSession | null> {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE_NAME)?.value);
}
