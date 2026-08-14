import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Locator, Page, TestInfo } from "@playwright/test";

/**
 * Screenshots land somewhere predictable so they can be reviewed by eye after a
 * run, not only when something fails.
 */
const SHOT_DIR = process.env.E2E_SCREENSHOT_DIR ?? path.join(process.cwd(), "tests/e2e/screenshots");

export type ShotOptions = {
  /** Capture the whole scrollable page rather than just the viewport. */
  fullPage?: boolean;
  /** Bring this into view first, and capture the viewport around it. */
  scrollTo?: Locator;
};

export async function shot(
  page: Page,
  name: string,
  options: ShotOptions = {},
): Promise<string> {
  await mkdir(SHOT_DIR, { recursive: true });
  const file = path.join(SHOT_DIR, `${name}.png`);

  // The flow smooth-scrolls on every step change; let that finish first.
  await page.waitForTimeout(400);

  if (options.scrollTo) {
    await options.scrollTo.evaluate((element) =>
      element.scrollIntoView({ block: "center", behavior: "instant" }),
    );
  } else {
    // Sticky and fixed elements are painted at their viewport offset, so a
    // full-page capture only looks right from the top of the page.
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await page.waitForTimeout(300);

  await page.screenshot({ path: file, fullPage: options.fullPage ?? false });
  return file;
}

/**
 * Collects browser console errors and uncaught exceptions for the lifetime of a
 * test. A booking flow that logs errors is not a booking flow that works.
 */
export function watchForConsoleErrors(page: Page): string[] {
  const problems: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => {
    problems.push(`pageerror: ${error.message}`);
  });
  page.on("requestfailed", (request) => {
    // Navigation aborts during client-side routing are normal; server errors are not.
    const failure = request.failure()?.errorText ?? "";
    if (failure && !failure.includes("net::ERR_ABORTED")) {
      problems.push(`requestfailed: ${request.url()} ${failure}`);
    }
  });

  return problems;
}

export async function attachScreenshot(
  testInfo: TestInfo,
  page: Page,
  name: string,
  options: ShotOptions = {},
): Promise<void> {
  const file = await shot(page, name, options);
  await testInfo.attach(name, { path: file, contentType: "image/png" });
}
