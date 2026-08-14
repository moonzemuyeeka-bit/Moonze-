import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/config";

/**
 * First gate in front of the admin area plus baseline security headers.
 *
 * This only checks that a session cookie is present — the cookie's signature and
 * expiry are verified server-side in the admin layout and in every admin API
 * route, which is where authorisation actually happens.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminArea =
    pathname.startsWith("/admin") && !pathname.startsWith("/admin/login");

  if (isAdminArea && !request.cookies.get(SESSION_COOKIE_NAME)) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return applySecurityHeaders(NextResponse.redirect(loginUrl));
  }

  return applySecurityHeaders(NextResponse.next());
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons|favicon.ico).*)"],
};
