import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeSession, type AdminSession } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME } from "@/lib/config";

/**
 * The admin guard reads the session from the request cookies, so the cookie
 * store is the only thing stubbed here — the route handlers, guard, validation
 * and database access under test are the real ones.
 */
const cookieJar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

const { authenticateAdmin } = await import("@/lib/auth/guard");
const { prisma } = await import("@/lib/database/client");
const { UnauthorizedError } = await import("@/lib/errors");
const { RATE_LIMITS, resetRateLimits } = await import("@/lib/rate-limit");
const adminSession = await import("@/app/api/admin/session/route");
const adminServices = await import("@/app/api/admin/services/route");
const adminBookings = await import("@/app/api/admin/bookings/route");
const adminAvailability = await import("@/app/api/admin/availability/route");
const adminSettings = await import("@/app/api/admin/settings/route");
const adminTimeSlots = await import("@/app/api/admin/time-slots/route");
const publicServices = await import("@/app/api/services/route");
const { resetDatabase, seedAdmin, seedBaseline, tradingDateKey } = await import(
  "../helpers/fixtures"
);

const PASSWORD = "KokoLashes2026!";

function signIn(overrides: Partial<AdminSession> = {}) {
  cookieJar.set(
    SESSION_COOKIE_NAME,
    encodeSession({
      userId: "admin-1",
      email: "owner@kokosbookings.zm",
      name: "Koko",
      role: "ADMIN",
      expiresAt: Math.floor(Date.now() / 1000) + 3_600,
      ...overrides,
    }),
  );
}

function signOut() {
  cookieJar.clear();
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(async () => {
  signOut();
  await resetDatabase();
  await seedBaseline();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("admin sign-in", () => {
  it("accepts the owner's password", async () => {
    await seedAdmin("owner@kokosbookings.zm", PASSWORD);
    const user = await authenticateAdmin("Owner@KokosBookings.zm", PASSWORD);

    expect(user.email).toBe("owner@kokosbookings.zm");
    expect(user.role).toBe("ADMIN");

    const refreshed = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(refreshed.lastLoginAt).not.toBeNull();
  });

  it("rejects a wrong password and an unknown account with the same message", async () => {
    await seedAdmin("owner@kokosbookings.zm", PASSWORD);

    await expect(authenticateAdmin("owner@kokosbookings.zm", "wrong")).rejects.toThrow(
      UnauthorizedError,
    );
    await expect(authenticateAdmin("nobody@example.com", PASSWORD)).rejects.toThrow(
      /do not match an admin account/,
    );
  });

  it("throttles password guessing but not the owner who gets it right", async () => {
    await seedAdmin("owner@kokosbookings.zm", PASSWORD);
    resetRateLimits();

    const attempt = (password: string) =>
      adminSession.POST(
        new Request("http://t/api/admin/session", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7" },
          body: JSON.stringify({ email: "owner@kokosbookings.zm", password }),
        }),
      );

    for (let guess = 0; guess < RATE_LIMITS.adminLogin.limit; guess += 1) {
      expect((await attempt("wrong-password")).status).toBe(401);
    }

    const blocked = await attempt("wrong-password");
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error.code).toBe("RATE_LIMITED");

    // A correct password clears the record, so the next sign-in is not punished.
    resetRateLimits();
    expect((await attempt(PASSWORD)).status).toBe(200);
    for (let signIn = 0; signIn < RATE_LIMITS.adminLogin.limit + 2; signIn += 1) {
      expect((await attempt(PASSWORD)).status).toBe(200);
    }
  });
});

describe("admin API authorisation", () => {
  const guarded: Array<[string, () => Promise<Response>]> = [
    ["GET /api/admin/services", () => adminServices.GET()],
    [
      "POST /api/admin/services",
      () =>
        adminServices.POST(
          jsonRequest("http://t/api/admin/services", "POST", {
            name: "Hacked Service",
            description: "Should never be created by an anonymous caller.",
            priceKwacha: 1,
            durationMinutes: 30,
          }),
        ),
    ],
    [
      "PATCH /api/admin/bookings",
      () =>
        adminBookings.PATCH(
          jsonRequest("http://t/api/admin/bookings", "PATCH", {
            reference: "KOKO-ABC234",
            status: "CONFIRMED",
          }),
        ),
    ],
    [
      "POST /api/admin/availability",
      () =>
        adminAvailability.POST(
          jsonRequest("http://t/api/admin/availability", "POST", {
            date: tradingDateKey(),
            status: "UNAVAILABLE",
          }),
        ),
    ],
    [
      "PUT /api/admin/settings",
      () =>
        adminSettings.PUT(
          jsonRequest("http://t/api/admin/settings", "PUT", { depositKwacha: 0 }),
        ),
    ],
    [
      "POST /api/admin/time-slots",
      () =>
        adminTimeSlots.POST(
          jsonRequest("http://t/api/admin/time-slots", "POST", {
            date: tradingDateKey(),
            startTime: "09:00",
            endTime: "11:00",
          }),
        ),
    ],
  ];

  it.each(guarded)("refuses %s without a session", async (_name, call) => {
    const response = await call();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("refuses a tampered session cookie", async () => {
    cookieJar.set(SESSION_COOKIE_NAME, "forged.payload");
    expect((await adminServices.GET()).status).toBe(401);
  });

  it("refuses an expired session cookie", async () => {
    signIn({ expiresAt: Math.floor(Date.now() / 1000) - 10 });
    expect((await adminServices.GET()).status).toBe(401);
  });

  it("creates nothing while refusing an unauthenticated write", async () => {
    await adminServices.POST(
      jsonRequest("http://t/api/admin/services", "POST", {
        name: "Hacked Service",
        description: "Should never be created by an anonymous caller.",
        priceKwacha: 1,
        durationMinutes: 30,
      }),
    );
    expect(await prisma.service.count({ where: { name: "Hacked Service" } })).toBe(0);
  });

  it("lets a signed-in owner manage services", async () => {
    signIn();
    const response = await adminServices.POST(
      jsonRequest("http://t/api/admin/services", "POST", {
        name: "Bridal Set",
        description: "A soft, photogenic set for the big day.",
        priceKwacha: 600,
        durationMinutes: 150,
        active: true,
        featured: false,
        priceFrom: false,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.service.priceNgwee).toBe(60_000);
    expect(body.data.service.slug).toBe("bridal-set");
  });

  it("lets a signed-in owner block and reopen a date", async () => {
    signIn();
    const date = tradingDateKey(20);

    const blocked = await adminAvailability.POST(
      jsonRequest("http://t/api/admin/availability", "POST", {
        date,
        status: "UNAVAILABLE",
        reason: "Personal day",
      }),
    );
    expect(blocked.status).toBe(200);
    expect(await prisma.availability.count({ where: { status: "UNAVAILABLE" } })).toBe(1);

    // Reopening removes the override so the weekly working hours apply again.
    const reopened = await adminAvailability.POST(
      jsonRequest("http://t/api/admin/availability", "POST", { date, status: "AVAILABLE" }),
    );
    expect(reopened.status).toBe(200);
    expect(await prisma.availability.count()).toBe(0);
  });

  it("validates admin input rather than trusting the client", async () => {
    signIn();
    const response = await adminServices.POST(
      jsonRequest("http://t/api/admin/services", "POST", {
        name: "",
        description: "short",
        priceKwacha: -5,
        durationMinutes: 0,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(body.error.fields).length).toBeGreaterThan(0);
  });

  it("leaves the customer-facing service list open to everyone", async () => {
    signOut();
    const response = await publicServices.GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.services.length).toBeGreaterThan(0);
  });
});
