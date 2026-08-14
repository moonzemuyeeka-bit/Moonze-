import { db } from "@/lib/db";

/**
 * Empties every application table between tests.
 *
 * The table list is read from the catalogue rather than hard-coded, so a new
 * model can never quietly leak rows from one test into the next. `_prisma_migrations`
 * is preserved: the schema is migrated once per run by the global setup.
 */
let cachedTables: string[] | null = null;

async function applicationTables(): Promise<string[]> {
  if (cachedTables) return cachedTables;

  const rows = await db.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `;

  cachedTables = rows.map((row) => row.tablename);
  return cachedTables;
}

export async function truncateAll(): Promise<void> {
  const tables = await applicationTables();
  if (tables.length === 0) return;

  const quoted = tables.map((table) => `"public"."${table}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
}
