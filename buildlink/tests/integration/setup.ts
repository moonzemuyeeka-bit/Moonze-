import { config as loadEnv } from "dotenv";
import { afterAll, beforeEach } from "vitest";

/**
 * Per-file integration setup.
 *
 * This runs before any test module is imported, which is the only safe moment
 * to repoint DATABASE_URL at the test database: `src/lib/db` reads it when it
 * constructs the single PrismaClient.
 */
loadEnv({ path: ".env", quiet: true });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is not set — see .env.example.");
}

// NODE_ENV is typed as read-only, but Vitest already sets it to "test" and the
// env contract needs to see it before `src/lib/env` is imported.
Object.assign(process.env, { NODE_ENV: "test" });
process.env.DATABASE_URL = testDatabaseUrl;
process.env.DIRECT_DATABASE_URL = testDatabaseUrl;
// Keep hashing fast; the cost factor is what makes bcrypt slow, and these tests
// create users constantly.
process.env.BCRYPT_COST = "4";
process.env.AUTH_SECRET ??= "integration-test-secret-that-is-long-enough-to-pass";
process.env.RATE_LIMIT_DRIVER = "db";
process.env.ANALYTICS_DRIVER = "none";
process.env.PAYMENT_PROVIDER = "sandbox";
process.env.ALLOW_SANDBOX_PAYMENTS = "true";
process.env.STORAGE_DRIVER = "local";

await import("./mocks/next");

const { db } = await import("@/lib/db");
const { truncateAll } = await import("./helpers/database");
const { resetRequestContext } = await import("./helpers/request-context");

beforeEach(async () => {
  resetRequestContext();
  await truncateAll();
});

afterAll(async () => {
  await db.$disconnect();
});
