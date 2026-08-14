import { execFileSync } from "node:child_process";
import { loadTestEnv } from "./test-env";

/**
 * Brings the test database up to the current migration history once per
 * `npm test`. Each suite then truncates the tables it uses, so the run is
 * repeatable without ever dropping a database.
 */
export default function setup() {
  const databaseUrl = loadTestEnv();

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });
}
