import { execFileSync } from "node:child_process";
import { config as loadEnv } from "dotenv";

/**
 * Prepares the integration test database once per run.
 *
 * Migrations are applied with `prisma migrate deploy` against
 * TEST_DATABASE_URL — the same command production uses, so a migration that
 * would fail on deploy fails here first. Reference data is *not* seeded: each
 * test builds exactly the rows it needs, which keeps failures readable.
 */
export default function setup() {
  loadEnv({ path: ".env", quiet: true });

  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Copy .env.example to .env and point it at a throwaway database.",
    );
  }
  if (!/(_test|test_)/i.test(databaseUrl)) {
    throw new Error(
      `Refusing to run integration tests against ${databaseUrl}: the database name must contain "test", because the suite truncates every table.`,
    );
  }

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DIRECT_DATABASE_URL: databaseUrl,
    },
  });
}
