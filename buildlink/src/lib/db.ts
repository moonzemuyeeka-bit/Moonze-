import "server-only";
// eslint-disable-next-line no-restricted-imports -- this module owns the single client instance
import { PrismaClient } from "@prisma/client";

/**
 * A single PrismaClient per process.
 *
 * Next.js hot-reloads server modules in development, which would otherwise open
 * a new connection pool on every edit until Postgres refuses connections. In
 * production (including serverless), one client per instance is exactly what we
 * want — connection pooling itself belongs to the database provider (pgBouncer
 * on Supabase, the Neon pooler endpoint), configured through DATABASE_URL.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export type Database = typeof db;

/**
 * Transaction client type. Domain helpers accept this so they compose inside a
 * `db.$transaction(...)` without knowing whether they are the outermost caller.
 */
export type DatabaseClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;
