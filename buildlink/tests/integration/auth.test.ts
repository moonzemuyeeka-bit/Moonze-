import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import {
  changePasswordAction,
  loginAction,
  logoutAction,
  registerCustomerAction,
  registerSupplierAction,
} from "@/server/auth/actions";
import { captureRedirect, currentCookies, setRequestIp } from "./helpers/request-context";
import {
  createCategory,
  createLocation,
  createUser,
  signIn,
  TEST_PASSWORD,
} from "./helpers/factories";

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) for (const item of value) data.append(key, item);
    else data.set(key, value);
  }
  return data;
}

const REGISTRATION_FIELDS = {
  name: "Chanda Mulenga",
  email: "chanda@example.test",
  phone: "0977123456",
  password: "Ntemba-Build-2026",
  confirmPassword: "Ntemba-Build-2026",
  acceptTerms: "on",
};

describe("customer registration", () => {
  it("creates an active customer with a profile, session and audit trail", async () => {
    const destination = await captureRedirect(() =>
      registerCustomerAction(null, form(REGISTRATION_FIELDS)),
    );

    expect(destination).toBe("/customer/onboarding");

    const user = await db.user.findUniqueOrThrow({
      where: { email: "chanda@example.test" },
      include: { customerProfile: true, sessions: true },
    });

    expect(user.role).toBe("CUSTOMER");
    expect(user.status).toBe("ACTIVE");
    expect(user.customerProfile).not.toBeNull();
    expect(user.sessions).toHaveLength(1);
    // The phone is normalised to E.164 on the way in.
    expect(user.phone).toBe("+260977123456");

    const audit = await db.auditLog.findFirst({ where: { actorUserId: user.id } });
    expect(audit?.resourceType).toBe("user");

    const session = await getCurrentUser();
    expect(session?.id).toBe(user.id);
  });

  it("never stores the password in plain text", async () => {
    await captureRedirect(() => registerCustomerAction(null, form(REGISTRATION_FIELDS)));

    const user = await db.user.findUniqueOrThrow({ where: { email: "chanda@example.test" } });
    expect(user.passwordHash).not.toContain(REGISTRATION_FIELDS.password);
    expect(user.passwordHash.startsWith("$2")).toBe(true);
  });

  it("rejects a duplicate email without leaking whose it is", async () => {
    await createUser({ email: "taken@example.test" });

    const result = await registerCustomerAction(
      null,
      form({ ...REGISTRATION_FIELDS, email: "taken@example.test", phone: "" }),
    );

    expect(result?.ok).toBe(false);
    expect(result?.ok === false && result.fieldErrors?.email).toBeDefined();
    expect(await db.user.count({ where: { email: "taken@example.test" } })).toBe(1);
  });

  it("refuses a weak or mismatched password", async () => {
    const weak = await registerCustomerAction(
      null,
      form({ ...REGISTRATION_FIELDS, password: "password123", confirmPassword: "password123" }),
    );
    expect(weak?.ok).toBe(false);

    const mismatched = await registerCustomerAction(
      null,
      form({ ...REGISTRATION_FIELDS, confirmPassword: "Something-Else-2026" }),
    );
    expect(mismatched?.ok === false && mismatched.fieldErrors?.confirmPassword).toBeDefined();

    expect(await db.user.count()).toBe(0);
  });

  it("requires the payment-handling acknowledgement", async () => {
    const result = await registerCustomerAction(
      null,
      form({ ...REGISTRATION_FIELDS, acceptTerms: "" }),
    );

    expect(result?.ok).toBe(false);
    expect(result?.ok === false && result.fieldErrors?.acceptTerms).toBeDefined();
  });

  it("rejects a phone number that is not Zambian", async () => {
    const result = await registerCustomerAction(
      null,
      form({ ...REGISTRATION_FIELDS, phone: "+447700900000" }),
    );

    expect(result?.ok).toBe(false);
    expect(result?.ok === false && result.fieldErrors?.phone).toBeDefined();
  });
});

describe("supplier registration", () => {
  it("creates the business as pending verification with a verification record", async () => {
    const location = await createLocation();
    const category = await createCategory();

    let returned: unknown;
    const destination = await captureRedirect(async () => {
      returned = await registerSupplierAction(
        null,
        form({
          contactName: "Mwansa Banda",
          email: "sales@example.test",
          phone: "0966555444",
          password: "Kabwe-Yard-2026",
          confirmPassword: "Kabwe-Yard-2026",
          businessName: "Kabwe Building Supplies",
          provinceId: location.provinceId,
          districtId: location.districtId,
          categoryIds: [category.id],
          deliveryAvailable: "on",
          registrationNumber: "120210001234",
          acceptTerms: "on",
        }),
      );
    });

    expect(returned, "registration returned an error instead of redirecting").toBeUndefined();
    expect(destination).toBe("/supplier/dashboard");

    const supplier = await db.supplierProfile.findFirstOrThrow({
      include: { verifications: true, categories: true, user: true },
    });

    expect(supplier.user.role).toBe("SUPPLIER");
    // A new business is never verified on the strength of its own claim.
    expect(supplier.verificationStatus).toBe("PENDING");
    expect(supplier.verifiedAt).toBeNull();
    expect(supplier.businessRegistrationStatus).toBe("SELF_DECLARED");
    expect(supplier.verifications).toHaveLength(1);
    expect(supplier.categories).toHaveLength(1);
    expect(supplier.slug).toBe("kabwe-building-supplies");
  });

  it("gives a second business with the same name a distinct web address", async () => {
    const location = await createLocation();
    const category = await createCategory();

    const base = {
      phone: "0966555444",
      password: "Kabwe-Yard-2026",
      confirmPassword: "Kabwe-Yard-2026",
      businessName: "Kabwe Building Supplies",
      provinceId: location.provinceId,
      categoryIds: [category.id],
      acceptTerms: "on",
    };

    await captureRedirect(() =>
      registerSupplierAction(
        null,
        form({ ...base, contactName: "Mwansa Banda", email: "one@example.test" }),
      ),
    );
    await captureRedirect(() =>
      registerSupplierAction(
        null,
        form({ ...base, contactName: "Bwalya Phiri", email: "two@example.test", phone: "0966555445" }),
      ),
    );

    const slugs = (await db.supplierProfile.findMany({ select: { slug: true } })).map((s) => s.slug);
    expect(new Set(slugs).size).toBe(2);
    expect(slugs).toContain("kabwe-building-supplies");
    expect(slugs).toContain("kabwe-building-supplies-2");
  });

  it("requires at least one real category", async () => {
    const location = await createLocation();

    const result = await registerSupplierAction(
      null,
      form({
        contactName: "Mwansa Banda",
        email: "sales@example.test",
        phone: "0966555444",
        password: "Kabwe-Yard-2026",
        confirmPassword: "Kabwe-Yard-2026",
        businessName: "Kabwe Building Supplies",
        provinceId: location.provinceId,
        categoryIds: ["6f2b6d1e-6c1e-4c5e-9b1e-2f1a3b4c5d6e"],
        acceptTerms: "on",
      }),
    );

    expect(result?.ok).toBe(false);
    expect(await db.user.count()).toBe(0);
  });
});

describe("sign in", () => {
  it("issues a session and lands each role on its own home page", async () => {
    const customer = await createUser({ email: "customer@example.test" });
    const destination = await captureRedirect(() =>
      loginAction(null, form({ email: "customer@example.test", password: TEST_PASSWORD })),
    );

    expect(destination).toBe("/customer/dashboard");
    expect(await db.session.count({ where: { userId: customer.id } })).toBe(1);

    const admin = await createUser({ email: "admin@example.test", role: "ADMIN" });
    currentCookies().clear();
    const adminDestination = await captureRedirect(() =>
      loginAction(null, form({ email: "admin@example.test", password: TEST_PASSWORD })),
    );
    expect(adminDestination).toBe("/admin/dashboard");
    expect(await db.session.count({ where: { userId: admin.id } })).toBe(1);
  });

  it("stores only a hash of the session token, never the token itself", async () => {
    await createUser({ email: "customer@example.test" });
    await captureRedirect(() =>
      loginAction(null, form({ email: "customer@example.test", password: TEST_PASSWORD })),
    );

    const cookie = currentCookies().get(SESSION_COOKIE_NAME);
    const session = await db.session.findFirstOrThrow();

    expect(cookie?.value).toBeTruthy();
    expect(session.tokenHash).not.toBe(cookie?.value);
    expect(session.tokenHash).toHaveLength(64);
  });

  it("sets an httpOnly, same-site session cookie", async () => {
    await createUser({ email: "customer@example.test" });
    await captureRedirect(() =>
      loginAction(null, form({ email: "customer@example.test", password: TEST_PASSWORD })),
    );

    const stored = currentCookies()
      .getAll()
      .find((cookie) => cookie.name === SESSION_COOKIE_NAME);

    expect(stored?.options.httpOnly).toBe(true);
    expect(stored?.options.sameSite).toBe("lax");
    expect(stored?.options.path).toBe("/");
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    await createUser({ email: "customer@example.test" });

    const wrongPassword = await loginAction(
      null,
      form({ email: "customer@example.test", password: "not-the-password" }),
    );
    const unknownEmail = await loginAction(
      null,
      form({ email: "nobody@example.test", password: TEST_PASSWORD }),
    );

    expect(wrongPassword?.ok).toBe(false);
    expect(unknownEmail?.ok).toBe(false);
    expect(wrongPassword?.ok === false && wrongPassword.error).toBe(
      unknownEmail?.ok === false ? unknownEmail.error : "",
    );
    expect(await db.session.count()).toBe(0);
  });

  it("locks an account after repeated failures and clears the count on success", async () => {
    const user = await createUser({ email: "customer@example.test" });

    for (let attempt = 0; attempt < 10; attempt += 1) {
      setRequestIp(`198.51.100.${attempt + 1}`);
      await loginAction(null, form({ email: "customer@example.test", password: "wrong" }));
    }

    const locked = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(locked.failedLogins).toBeGreaterThanOrEqual(10);
    expect(locked.lockedUntil).not.toBeNull();

    setRequestIp("198.51.100.200");
    const blocked = await loginAction(
      null,
      form({ email: "customer@example.test", password: TEST_PASSWORD }),
    );
    // Even the correct password is refused while the lock stands.
    expect(blocked?.ok).toBe(false);
    expect(blocked?.ok === false && blocked.code).toBe("ACCOUNT_LOCKED");

    await db.user.update({ where: { id: user.id }, data: { lockedUntil: null } });
    await captureRedirect(() =>
      loginAction(null, form({ email: "customer@example.test", password: TEST_PASSWORD })),
    );
    const recovered = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(recovered.failedLogins).toBe(0);
    expect(recovered.lastLoginAt).not.toBeNull();
  });

  it("rate-limits sign-in attempts from one address", async () => {
    await createUser({ email: "customer@example.test" });
    setRequestIp("198.51.100.77");

    const outcomes: Array<string | undefined> = [];
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const result = await loginAction(
        null,
        form({ email: "customer@example.test", password: "wrong" }),
      );
      outcomes.push(result?.ok === false ? result.code : undefined);
    }

    expect(outcomes).toContain("RATE_LIMITED");
  });

  it("refuses a closed account", async () => {
    await createUser({ email: "closed@example.test", status: "DEACTIVATED" });

    const result = await loginAction(
      null,
      form({ email: "closed@example.test", password: TEST_PASSWORD }),
    );

    expect(result?.ok).toBe(false);
    expect(result?.ok === false && result.code).toBe("ACCOUNT_CLOSED");
  });

  it("ignores an off-site redirect target", async () => {
    await createUser({ email: "customer@example.test" });

    const destination = await captureRedirect(() =>
      loginAction(
        null,
        form({
          email: "customer@example.test",
          password: TEST_PASSWORD,
          next: "https://evil.example/steal",
        }),
      ),
    );

    expect(destination).toBe("/customer/dashboard");
  });

  it("honours a same-site redirect target", async () => {
    await createUser({ email: "customer@example.test" });

    const destination = await captureRedirect(() =>
      loginAction(
        null,
        form({ email: "customer@example.test", password: TEST_PASSWORD, next: "/cart" }),
      ),
    );

    expect(destination).toBe("/cart");
  });
});

describe("session lifecycle", () => {
  it("resolves the signed-in user and forgets them after sign-out", async () => {
    const user = await createUser();
    await signIn(user.id);

    expect((await getCurrentUser())?.id).toBe(user.id);

    await captureRedirect(() => logoutAction());

    expect(await db.session.count()).toBe(0);
    expect(currentCookies().get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("treats an expired session as signed out and cleans it up", async () => {
    const user = await createUser();
    await signIn(user.id);
    await db.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1_000) } });

    expect(await getCurrentUser()).toBeNull();
    expect(await db.session.count()).toBe(0);
  });

  it("rejects a forged session token", async () => {
    const user = await createUser();
    await signIn(user.id);
    currentCookies().set(SESSION_COOKIE_NAME, "forged-token-value");

    expect(await getCurrentUser()).toBeNull();
  });

  it("stops honouring the session of a closed account immediately", async () => {
    const user = await createUser();
    await signIn(user.id);
    await db.user.update({ where: { id: user.id }, data: { status: "DEACTIVATED" } });

    expect(await getCurrentUser()).toBeNull();
  });

  it("signs other devices out when the password changes", async () => {
    const user = await createUser({ email: "customer@example.test" });
    // Two devices, two sessions.
    await signIn(user.id);
    await signIn(user.id);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(2);

    const result = await changePasswordAction(
      null,
      form({
        currentPassword: TEST_PASSWORD,
        newPassword: "Chalala-House-2026",
        confirmPassword: "Chalala-House-2026",
      }),
    );

    expect(result.ok).toBe(true);
    // Every old session is gone; only the one that changed the password remains.
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);

    const signedIn = await loginAction(
      null,
      form({ email: "customer@example.test", password: "Chalala-House-2026" }),
    ).catch((error: unknown) => error);
    expect(signedIn).toBeInstanceOf(Error);
  });

  it("refuses a password change without the current password", async () => {
    const user = await createUser();
    await signIn(user.id);
    const before = await db.user.findUniqueOrThrow({ where: { id: user.id } });

    const result = await changePasswordAction(
      null,
      form({
        currentPassword: "wrong",
        newPassword: "Chalala-House-2026",
        confirmPassword: "Chalala-House-2026",
      }),
    );

    expect(result.ok).toBe(false);
    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  it("refuses a password change when nobody is signed in", async () => {
    const result = await changePasswordAction(
      null,
      form({
        currentPassword: TEST_PASSWORD,
        newPassword: "Chalala-House-2026",
        confirmPassword: "Chalala-House-2026",
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("UNAUTHENTICATED");
  });
});
