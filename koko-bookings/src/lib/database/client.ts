import { PrismaClient } from "@/generated/prisma";

/**
 * A single Prisma client per process. Next.js hot-reloads modules in
 * development, so the instance is cached on `globalThis` to avoid exhausting
 * the connection pool.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type { Prisma } from "@/generated/prisma";
