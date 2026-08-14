import { defineConfig } from "@playwright/test";

/**
 * Browser-level tests. They run against a production build on a phone-sized
 * viewport, because that is how nearly every customer will arrive.
 *
 * Run `npm run build` first, then `npm run test:e2e`.
 */

const port = Number(process.env.E2E_PORT ?? 3001);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./tests/e2e/.output",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    browserName: "chromium",
    // Uses the Chrome already installed on the machine, so there is no separate
    // browser download step.
    channel: "chrome",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    trace: "retain-on-failure",
    video: "off",
  },
  webServer: {
    command: `PORT=${port} npm run start`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
