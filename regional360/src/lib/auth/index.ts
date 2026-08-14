import { cookies } from "next/headers";

// Clean auth abstraction. The MVP ships a demo login only; the SessionUser
// shape and helpers are structured so enterprise SSO can be layered in later
// (swap the cookie-based session for an identity-provider session).

export const SESSION_COOKIE = "r360_session";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "Regional Manager";
  region: string;
  demo: boolean;
}

export const DEMO_USER: SessionUser = {
  id: "user-demo",
  name: "Alex Morgan",
  email: "alex.morgan@regional360.example",
  role: "Regional Manager",
  region: "North America — Enterprise",
  demo: true,
};

function encode(user: SessionUser): string {
  return Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
}

function decode(value: string): SessionUser | null {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return decode(raw);
}

export async function createDemoSession(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, encode(DEMO_USER), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
