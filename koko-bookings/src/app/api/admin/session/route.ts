import { authenticateAdmin } from "@/lib/auth/guard";
import { createSessionCookie, destroySessionCookie } from "@/lib/auth/session";
import { apiSuccess, readJson, route } from "@/lib/http";
import {
  assertRateLimit,
  clearRateLimit,
  clientKey,
  RATE_LIMITS,
  recordRateLimitHit,
} from "@/lib/rate-limit";
import { adminLoginSchema } from "@/schemas/admin";

/** Admin sign in. Rate limited to blunt password guessing. */
export const POST = route(async (request: Request) => {
  const throttleKey = clientKey(request, "adminLogin");
  assertRateLimit(throttleKey, RATE_LIMITS.adminLogin);

  const { email, password } = adminLoginSchema.parse(await readJson(request));

  let user;
  try {
    user = await authenticateAdmin(email, password);
  } catch (error) {
    // Only failed attempts count, so guessing slows down while an owner who
    // signs in often never locks themselves out.
    recordRateLimitHit(throttleKey, RATE_LIMITS.adminLogin);
    throw error;
  }

  clearRateLimit(throttleKey);
  await createSessionCookie(user);

  return apiSuccess({ user: { name: user.name, email: user.email, role: user.role } });
});

/** Admin sign out. */
export const DELETE = route(async () => {
  await destroySessionCookie();
  return apiSuccess({ signedOut: true });
});
