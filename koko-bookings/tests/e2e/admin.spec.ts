import { expect, test } from "@playwright/test";
import { attachScreenshot, watchForConsoleErrors } from "./helpers";

/**
 * The owner's side: admin pages are closed to the public, and once signed in the
 * dashboard is usable from a phone.
 */

const EMAIL = process.env.ADMIN_EMAIL ?? "owner@kokosbookings.zm";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "KokoLashes2026!";

test("the admin area is protected", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

  await page.goto("/admin/bookings");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("wrong credentials are rejected", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill("definitely-not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Sign in failed")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("the owner signs in and runs the business from a phone", async ({ page }, testInfo) => {
  const problems = watchForConsoleErrors(page);

  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { name: "Today at a glance" })).toBeVisible();
  await expect(page.getByText("Deposits collected")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Revenue" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Next appointment" })).toBeVisible();
  await attachScreenshot(testInfo, page, "09_admin_dashboard_on_a_phone", { fullPage: true });

  await test.step("bookings can be filtered and searched", async () => {
    await page.goto("/admin/bookings");
    await expect(page.getByRole("heading", { name: "Bookings" })).toBeVisible();

    const references = page.getByText(/^KOKO-[0-9A-Z]{6}$/);
    await expect(references.first()).toBeVisible();
    await attachScreenshot(testInfo, page, "10_admin_bookings_on_a_phone");

    await page.goto("/admin/bookings?filter=confirmed");
    await expect(page.getByText("Confirmed", { exact: true }).first()).toBeVisible();
  });

  await test.step("services and their prices are editable", async () => {
    await page.goto("/admin/services");
    await expect(page.getByRole("heading", { name: "Services & prices" })).toBeVisible();
    await expect(page.getByText("Volume").first()).toBeVisible();
    await expect(page.getByText("K500").first()).toBeVisible();
  });

  await test.step("the calendar is there to block dates and manage slots", async () => {
    await page.goto("/admin/calendar");
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
  });

  await test.step("settings hold the business rules", async () => {
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: "Business settings" })).toBeVisible();
    await expect(page.getByLabel("Deposit (K)")).toBeVisible();
    await expect(page.getByLabel("Buffer between clients (minutes)")).toBeVisible();
  });

  expect(problems, `browser reported problems:\n${problems.join("\n")}`).toEqual([]);
});

test.describe("at desktop width", () => {
  test.use({
    viewport: { width: 1440, height: 900 },
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 1,
  });

  test("the dashboard swaps the tab strip for a navigation rail", async ({ page }, testInfo) => {
    const problems = watchForConsoleErrors(page);

    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("heading", { name: "Today at a glance" })).toBeVisible();

    // These only exist in the desktop rail, which is hidden on a phone.
    await expect(page.getByText(/^Signed in as /)).toBeVisible();
    await expect(page.getByRole("link", { name: "View customer site" })).toBeVisible();
    for (const item of ["Calendar", "Bookings", "Services", "Customers", "Payments", "Settings"]) {
      await expect(page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: item })).toBeVisible();
    }

    // The revenue chart is drawn with divs, so a layout slip can silently
    // flatten every bar to nothing. Measure the tallest one.
    const tallestBar = await page
      .locator("figure div[title]")
      .evaluateAll((bars) =>
        Math.max(0, ...bars.map((bar) => bar.getBoundingClientRect().height)),
      );
    expect(tallestBar).toBeGreaterThan(40);

    await attachScreenshot(testInfo, page, "11_admin_dashboard_at_desktop_width");

    expect(problems, `browser reported problems:\n${problems.join("\n")}`).toEqual([]);
  });
});
