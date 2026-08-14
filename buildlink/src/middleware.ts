import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session.edge";

/**
 * Edge middleware — a cheap first gate, never the authorisation decision.
 *
 * Middleware runs on the edge runtime with no database access, so it can only
 * check whether a session cookie is present. That is enough to send a signed-out
 * visitor to the sign-in page with a `next` parameter instead of flashing an
 * empty dashboard. The real check — is this session valid, is this account
 * active, does this role hold the required permission — happens in every page
 * and every action through `lib/auth/guards.ts`.
 */

const PROTECTED_PREFIXES = [
  "/customer",
  "/supplier/dashboard",
  "/supplier/products",
  "/supplier/orders",
  "/supplier/contracts",
  "/supplier/customers",
  "/supplier/analytics",
  "/supplier/verification",
  "/supplier/settings",
  "/supplier/onboarding",
  "/delivery",
  "/admin",
  "/cart",
  "/checkout",
  "/orders",
  "/agreements",
  "/notifications",
  "/account",
] as const;

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const needsSession = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!needsSession) return NextResponse.next();

  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
  if (hasSessionCookie) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  /**
   * Skip static assets and the API surface. API route handlers authenticate
   * themselves, and matching them here would only add latency.
   */
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
