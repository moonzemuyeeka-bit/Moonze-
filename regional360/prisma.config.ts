import path from "node:path";
import { defineConfig } from "prisma/config";

// Connection URL lives here in Prisma 7+. The demo MVP does not require a
// database; set DATABASE_URL when wiring a managed PostgreSQL provider.
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
});
