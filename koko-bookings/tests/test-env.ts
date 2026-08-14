import { config as loadDotEnv } from "dotenv";

/**
 * Points every import at the throwaway test database.
 *
 * This runs before the Prisma client is constructed, and refuses to continue
 * unless TEST_DATABASE_URL is set and different from DATABASE_URL — a test run
 * must never be able to truncate the development database.
 */
const SWITCHED_FLAG = "KOKO_TEST_DATABASE_READY";

export function loadTestEnv(): string {
  loadDotEnv({ path: ".env", quiet: true });

  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error(
      "TEST_DATABASE_URL is required to run the test suite. Copy .env.example to .env.",
    );
  }
  // Vitest workers inherit the already-switched environment from global setup,
  // so only the first call compares the two URLs.
  if (process.env[SWITCHED_FLAG] !== "1" && testUrl === process.env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL must point at a different database to DATABASE_URL.");
  }

  process.env.DATABASE_URL = testUrl;
  process.env[SWITCHED_FLAG] = "1";
  process.env.PAYMENT_PROVIDER = "mock";
  process.env.DEMO_MODE = "true";
  process.env.SESSION_SECRET ||= "test-session-secret-at-least-32-characters-long";
  process.env.PAYMENT_WEBHOOK_SECRET ||= "test-webhook-secret-value";
  return testUrl;
}
