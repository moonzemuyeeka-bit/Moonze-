import { expect, test, type Locator, type Page } from "@playwright/test";
import { attachScreenshot, watchForConsoleErrors } from "./helpers";

/**
 * The journey a real customer takes, in a real browser, on a phone-sized
 * viewport: choose a service, pick a date and time, hand over details, accept
 * the deposit policy, pay the K50 deposit and land on a confirmation — then find
 * that booking again with nothing but the reference and phone number.
 */

const CUSTOMER = {
  name: "Naomi Tembo",
  phone: "0973112233",
  email: "naomi.tembo@example.com",
  notes: "First time booking a volume set.",
};

/** Only ever act on what a person could actually see and tap. */
function seen(locator: Locator): Locator {
  return locator.filter({ visible: true });
}

/** Reads a value out of the confirmation card's description list. */
function detail(page: Page, label: string): Locator {
  return page.locator("dl > div").filter({ hasText: label }).locator("dd");
}

test("customer books a Volume set, pays the K50 deposit and retrieves the booking", async ({
  page,
}, testInfo) => {
  const problems = watchForConsoleErrors(page);

  await test.step("home page invites the customer to book", async () => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Beautiful lashes/ }),
    ).toBeVisible();
    await expect(page.getByText("K50 deposit secures your slot")).toBeVisible();
    await attachScreenshot(testInfo, page, "01_homepage_on_a_phone");

    await seen(page.getByRole("link", { name: "Book an Appointment", exact: true }))
      .first()
      .click();
    await expect(page).toHaveURL(/\/book$/);
  });

  await test.step("step 1 — choose the Volume service at K500", async () => {
    await expect(page.getByRole("heading", { name: "Choose your lash service" })).toBeVisible();

    // Popular services carry a "Popular" marker in their heading, so match the
    // start of the name rather than the whole accessible name.
    const volume = page
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { name: /^Volume\b/ }) });
    await expect(volume.getByText("K500")).toBeVisible();
    await expect(volume.getByText(/Approx\. 3 hours/)).toBeVisible();
    await attachScreenshot(testInfo, page, "02_service_selection");

    await volume.getByRole("button", { name: "Select" }).click();
    await expect(page.getByRole("heading", { name: "Pick your date & time" })).toBeVisible();
  });

  await test.step("step 2 — pick an open date and time", async () => {
    const calendar = page.getByRole("group", { name: /^Availability for/ });
    await expect(calendar).toBeVisible();

    // Only days the availability engine can fit this service into are enabled.
    const openDay = calendar.locator("button:not([disabled])").first();
    await expect(openDay).toBeVisible();
    await openDay.click();

    const openTime = page.getByRole("button", { name: /^\d{2}:\d{2} — Available$/ });
    await expect(openTime.first()).toBeVisible();
    await openTime.first().click();

    // Availability is spelled out in words, not carried by colour alone, and the
    // sticky bar keeps the deposit in view.
    const legend = page.locator("ul").filter({ hasText: "Fully booked" }).first();
    for (const label of ["Available", "Limited availability", "Fully booked", "Unavailable"]) {
      await expect(legend).toContainText(label);
    }
    await expect(page.getByText("Deposit: K50")).toBeVisible();
    await attachScreenshot(testInfo, page, "03_date_and_time_with_availability_legend");

    await seen(page.getByRole("button", { name: "Continue" })).click();
    await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible();
  });

  await test.step("step 3 — details, and the deposit policy has to be accepted", async () => {
    await page.getByLabel("Full name").fill(CUSTOMER.name);
    await page.getByLabel("Mobile number").fill(CUSTOMER.phone);
    await page.getByLabel("Email").fill(CUSTOMER.email);
    await page.getByLabel("Notes for your lash artist").fill(CUSTOMER.notes);

    await expect(page.getByRole("heading", { name: "Booking Deposit Policy" })).toBeVisible();
    await expect(
      page.getByText("A K50 deposit is required to secure your appointment slot."),
    ).toBeVisible();
    await expect(seen(page.getByText("Total Service"))).toBeVisible();
    await expect(seen(page.getByText("Balance After Deposit"))).toBeVisible();

    // Refuses to move on until the box is ticked.
    await seen(page.getByRole("button", { name: "Continue" })).click();
    await expect(page.getByText("Please accept the booking policy to continue.")).toBeVisible();
    await attachScreenshot(testInfo, page, "04_policy_must_be_accepted_before_paying", {
      scrollTo: page.getByText("Please accept the booking policy to continue."),
    });

    await page.getByRole("checkbox").check();
    await seen(page.getByRole("button", { name: "Continue" })).click();
    await expect(page.getByRole("heading", { name: "Secure your slot with K50" })).toBeVisible();
  });

  await test.step("step 4 — the deposit is spelled out before any payment", async () => {
    await expect(
      page.getByText("You are paying K50 now to secure this appointment."),
    ).toBeVisible();
    // The slot is only held for a limited window, and the customer can see it.
    await expect(page.getByRole("timer")).toContainText("We are holding this slot for");
    await attachScreenshot(testInfo, page, "05_deposit_breakdown_before_payment");

    await page.getByRole("radio", { name: /Pay with Mobile Money/ }).check();
    await page.getByRole("button", { name: /Pay K50 with Mobile Money/ }).click();

    await expect(page.getByText("Processing")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Appointment Confirmed/ })).toBeHidden();
    await attachScreenshot(testInfo, page, "06_payment_processing_not_yet_confirmed");
  });

  let reference = "";

  await test.step("the appointment is confirmed only once the deposit lands", async () => {
    await page.getByRole("button", { name: "Approve payment" }).click();

    await expect(page.getByRole("heading", { name: /Appointment Confirmed/ })).toBeVisible({
      timeout: 30_000,
    });

    reference = (await page.getByText(/^KOKO-[0-9A-Z]{6}$/).first().innerText()).trim();
    expect(reference).toMatch(/^KOKO-[0-9A-Z]{6}$/);

    await expect(detail(page, "Service")).toHaveText("Volume");
    await expect(detail(page, "Deposit Paid")).toHaveText("K50");
    await expect(detail(page, "Remaining Balance")).toHaveText("K450");
    await expect(detail(page, "Status")).toContainText("CONFIRMED");

    await expect(page.getByRole("link", { name: /Add to Calendar/ })).toHaveAttribute(
      "download",
      `${reference}.ics`,
    );
    await expect(page.getByRole("button", { name: /Share Booking/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "View Booking" })).toBeVisible();
    await attachScreenshot(testInfo, page, "07_booking_confirmed_with_reference", {
      fullPage: true,
    });
  });

  await test.step("the slot is gone for the next customer", async () => {
    const slots = await page.request.get("/api/services");
    expect(slots.ok()).toBeTruthy();

    const lookup = await page.request.post("/api/bookings/lookup", {
      data: { reference, phone: CUSTOMER.phone },
    });
    const body = await lookup.json();
    const { date, startTime, serviceId } = {
      date: body.data.booking.date,
      startTime: body.data.booking.startTime,
      serviceId: body.data.booking.serviceId,
    };

    const again = await page.request.post("/api/bookings", {
      data: {
        serviceId,
        date,
        startTime,
        customer: { name: "Second Customer", phone: "0966222333" },
        policyAccepted: true,
      },
    });
    expect(again.status()).toBe(409);
    expect((await again.json()).error.code).toBe("SLOT_UNAVAILABLE");
  });

  await test.step("the customer can find the booking again", async () => {
    await page.goto("/my-booking");
    await page.getByLabel("Booking reference").fill(reference);
    await page.getByLabel("Mobile number").fill(CUSTOMER.phone);
    await page.getByRole("button", { name: "Find my booking" }).click();

    await expect(page.getByText(reference).first()).toBeVisible();
    await expect(page.getByText(CUSTOMER.name)).toBeVisible();
    await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
    await expect(page.getByText("Balance due at the studio")).toBeVisible();
    await expect(page.getByText("K450")).toBeVisible();
    await attachScreenshot(testInfo, page, "08_customer_retrieves_the_booking");
  });

  expect(problems, `browser reported problems:\n${problems.join("\n")}`).toEqual([]);
});

test("a wrong reference is refused politely", async ({ page }) => {
  await page.goto("/my-booking");
  await page.getByLabel("Booking reference").fill("KOKO-000000");
  await page.getByLabel("Mobile number").fill("0977456789");
  await page.getByRole("button", { name: "Find my booking" }).click();

  await expect(page.getByText("We could not find that booking")).toBeVisible();
  await expect(page.getByText(/stack|Error:|at Object/i)).toHaveCount(0);
});
