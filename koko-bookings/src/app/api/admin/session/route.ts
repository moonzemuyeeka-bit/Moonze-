import { authenticateAdmin } from "@/lib/auth/guard";
import { createSessionCookie, destroySessionCookie } from "@/lib/auth/session";
import { apiSuccess, readJson, route } from "@/lib/http";
import { clientKey, consumeRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { adminLoginSchema } from "@/schemas/admin";

/** Admin sign in. Rate limited to blunt password guessing. */
export const POST = route(async (request: Request) => {
  consumeRateLimit(clientKey(request, "adminLogin"), RATE_LIMITS.adminLogin);

  const { email, password } = adminLoginSchema.parse(await readJson(request));
  const user = await authenticateAdmin(email, password);
  await createSessionCookie(user);

  return apiSuccess({ user: { name: user.name, email: user.email, role: user.role } });
});

/** Admin sign out. */
export const DELETE = route(async () => {
  await destroySessionCookie();
  return apiSuccess({ signedOut: true });
});
