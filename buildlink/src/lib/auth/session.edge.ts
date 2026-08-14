/**
 * Edge-safe session constants.
 *
 * `lib/auth/session.ts` is `server-only` and imports Prisma and `node:crypto`,
 * neither of which can run in middleware. The cookie name is the one thing
 * middleware needs, so it lives here where both runtimes can read it.
 */
export const SESSION_COOKIE_NAME = "buildlink_session";
