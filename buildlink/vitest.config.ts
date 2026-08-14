import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

/** Unit tests: pure domain logic, no database, no network. */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    name: "unit",
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    globals: false,
    reporters: ["default"],
  },
});
