import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { decodeSession, encodeSession, type AdminSession } from "@/lib/auth/session";
import { signWebhookPayload } from "@/lib/payments/mock-provider";
import {
  assertRateLimit,
  clearRateLimit,
  consumeRateLimit,
  RATE_LIMITS,
  recordRateLimitHit,
  resetRateLimits,
} from "@/lib/rate-limit";
import { RateLimitError } from "@/lib/errors";

function session(overrides: Partial<AdminSession> = {}): AdminSession {
  return {
    userId: "user-1",
    email: "owner@kokosbookings.zm",
    name: "Koko",
    role: "ADMIN",
    expiresAt: Math.floor(Date.now() / 1000) + 3_600,
    ...overrides,
  };
}

describe("admin passwords", () => {
  it("stores a salted hash rather than the password", async () => {
    const hash = await hashPassword("KokoLashes2026!");
    expect(hash).not.toContain("KokoLashes2026!");
    expect(hash.split("$")).toHaveLength(3);
    expect(hash.startsWith("scrypt$")).toBe(true);
  });

  it("accepts the right password and rejects everything else", async () => {
    const hash = await hashPassword("KokoLashes2026!");
    expect(await verifyPassword("KokoLashes2026!", hash)).toBe(true);
    expect(await verifyPassword("kokolashes2026!", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("salts each hash, so the same password hashes differently", async () => {
    const [first, second] = await Promise.all([
      hashPassword("KokoLashes2026!"),
      hashPassword("KokoLashes2026!"),
    ]);
    expect(first).not.toBe(second);
  });

  it("does not throw on a malformed stored hash", async () => {
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });
});

describe("admin sessions", () => {
  it("round-trips a signed session", () => {
    const original = session();
    expect(decodeSession(encodeSession(original))).toEqual(original);
  });

  it("rejects a tampered payload", () => {
    const token = encodeSession(session({ role: "STAFF" }));
    const [, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify(session({ role: "ADMIN" })),
      "utf8",
    ).toString("base64url");

    expect(decodeSession(`${forged}.${signature}`)).toBeNull();
  });

  it("rejects an expired session", () => {
    const token = encodeSession(session({ expiresAt: Math.floor(Date.now() / 1000) - 1 }));
    expect(decodeSession(token)).toBeNull();
  });

  it("rejects missing or malformed cookies", () => {
    expect(decodeSession(undefined)).toBeNull();
    expect(decodeSession("")).toBeNull();
    expect(decodeSession("no-signature")).toBeNull();
    expect(decodeSession("a.b")).toBeNull();
  });
});

describe("webhook signatures", () => {
  it("changes when the body changes", () => {
    const body = JSON.stringify({ providerReference: "MOCK-1", status: "SUCCESSFUL" });
    const forged = JSON.stringify({ providerReference: "MOCK-2", status: "SUCCESSFUL" });
    expect(signWebhookPayload(body)).not.toBe(signWebhookPayload(forged));
    expect(signWebhookPayload(body)).toBe(signWebhookPayload(body));
  });
});

describe("rate limiting", () => {
  it("allows a burst then blocks with a friendly message", () => {
    resetRateLimits();
    const rule = RATE_LIMITS.adminLogin;

    for (let attempt = 0; attempt < rule.limit; attempt += 1) {
      expect(() => consumeRateLimit("login:test", rule)).not.toThrow();
    }
    expect(() => consumeRateLimit("login:test", rule)).toThrow(RateLimitError);
    expect(() => consumeRateLimit("login:test", rule)).toThrow(/Too many attempts/);
  });

  it("counts each client separately", () => {
    resetRateLimits();
    const rule = { limit: 1, windowMs: 60_000 };
    consumeRateLimit("login:a", rule);
    expect(() => consumeRateLimit("login:b", rule)).not.toThrow();
    expect(() => consumeRateLimit("login:a", rule)).toThrow(RateLimitError);
  });

  it("opens a fresh window once the old one closes", async () => {
    resetRateLimits();
    const rule = { limit: 1, windowMs: 20 };
    consumeRateLimit("login:window", rule);
    expect(() => consumeRateLimit("login:window", rule)).toThrow(RateLimitError);

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(() => consumeRateLimit("login:window", rule)).not.toThrow();
  });

  it("can check the window without spending an attempt", () => {
    resetRateLimits();
    const rule = { limit: 1, windowMs: 60_000 };

    assertRateLimit("login:peek", rule);
    assertRateLimit("login:peek", rule);
    // Nothing was counted, so a real attempt is still allowed.
    expect(() => consumeRateLimit("login:peek", rule)).not.toThrow();
    expect(() => assertRateLimit("login:peek", rule)).toThrow(RateLimitError);
  });

  it("forgets the failures once the client gets it right", () => {
    resetRateLimits();
    const rule = RATE_LIMITS.adminLogin;

    for (let attempt = 0; attempt < rule.limit; attempt += 1) {
      recordRateLimitHit("login:mixed", rule);
    }
    expect(() => assertRateLimit("login:mixed", rule)).toThrow(RateLimitError);

    clearRateLimit("login:mixed");
    expect(() => assertRateLimit("login:mixed", rule)).not.toThrow();
  });
});
