import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { RateLimitError } from "@/lib/errors";

/**
 * Token-bucket rate limiting for sensitive endpoints (sign-in, registration,
 * payment initiation, file upload, search).
 *
 * Two drivers:
 *  * `db` — a single atomic `INSERT ... ON CONFLICT DO UPDATE` in Postgres, so
 *    the limit holds across serverless instances. This is the default.
 *  * `memory` — per-process map, fine for a single node or local development.
 *
 * The interface is the seam where Upstash/Redis would slot in later.
 */

export type RateLimitRule = {
  /** Requests permitted per window. */
  limit: number;
  windowSeconds: number;
};

export const RATE_LIMITS = {
  login: { limit: 8, windowSeconds: 300 },
  register: { limit: 5, windowSeconds: 3600 },
  passwordReset: { limit: 5, windowSeconds: 3600 },
  otpRequest: { limit: 5, windowSeconds: 900 },
  paymentInitiation: { limit: 20, windowSeconds: 3600 },
  upload: { limit: 40, windowSeconds: 3600 },
  paletteAnalysis: { limit: 20, windowSeconds: 3600 },
  search: { limit: 240, windowSeconds: 60 },
  mutation: { limit: 120, windowSeconds: 60 },
  contactReveal: { limit: 60, windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

const memoryBuckets = new Map<string, { tokens: number; resetAt: number }>();

export type RateLimitOutcome = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Consumes one token. Returns the outcome rather than throwing so callers can
 * choose between a soft degrade (search) and a hard stop (sign-in).
 */
export async function checkRateLimit(
  name: RateLimitName,
  identifier: string,
): Promise<RateLimitOutcome> {
  const rule = RATE_LIMITS[name];
  const key = `${name}:${identifier}`;

  if (env.RATE_LIMIT_DRIVER === "memory") {
    return consumeInMemory(key, rule);
  }

  try {
    return await consumeInDatabase(key, rule);
  } catch (error) {
    // A rate limiter must never take the whole feature down. Fall back to the
    // in-process bucket and record why.
    console.error("[buildlink] rate limiter unavailable, falling back to memory:", error);
    return consumeInMemory(key, rule);
  }
}

/** Consumes a token and throws `RateLimitError` when the bucket is empty. */
export async function enforceRateLimit(
  name: RateLimitName,
  identifier: string,
): Promise<void> {
  const outcome = await checkRateLimit(name, identifier);
  if (!outcome.allowed) {
    throw new RateLimitError(outcome.retryAfterSeconds);
  }
}

function consumeInMemory(key: string, rule: RateLimitRule): RateLimitOutcome {
  const now = Date.now();
  const existing = memoryBuckets.get(key);

  if (!existing || existing.resetAt <= now) {
    memoryBuckets.set(key, {
      tokens: rule.limit - 1,
      resetAt: now + rule.windowSeconds * 1000,
    });
    return { allowed: true, remaining: rule.limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.tokens <= 0) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.tokens -= 1;
  return { allowed: true, remaining: existing.tokens, retryAfterSeconds: 0 };
}

async function consumeInDatabase(
  key: string,
  rule: RateLimitRule,
): Promise<RateLimitOutcome> {
  const resetAt = new Date(Date.now() + rule.windowSeconds * 1000);

  const rows = await db.$queryRaw<Array<{ tokens: number; resetAt: Date }>>`
    INSERT INTO "RateLimitBucket" ("key", "tokens", "resetAt", "updatedAt")
    VALUES (${key}, ${rule.limit - 1}, ${resetAt}, NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "tokens" = CASE
        WHEN "RateLimitBucket"."resetAt" <= NOW() THEN ${rule.limit - 1}
        ELSE GREATEST("RateLimitBucket"."tokens" - 1, -1)
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= NOW() THEN ${resetAt}
        ELSE "RateLimitBucket"."resetAt"
      END,
      "updatedAt" = NOW()
    RETURNING "tokens", "resetAt"
  `;

  const row = rows[0];
  if (!row) {
    return { allowed: true, remaining: rule.limit - 1, retryAfterSeconds: 0 };
  }

  if (row.tokens < 0) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((row.resetAt.getTime() - Date.now()) / 1000),
    );
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  return { allowed: true, remaining: row.tokens, retryAfterSeconds: 0 };
}

/** Housekeeping for expired buckets. Safe to run from a scheduled job. */
export async function pruneRateLimitBuckets(): Promise<number> {
  const result = await db.rateLimitBucket.deleteMany({
    where: { resetAt: { lt: new Date(Date.now() - 60_000) } },
  });
  return result.count;
}

/** Test helper — the in-memory driver keeps state between cases otherwise. */
export function resetInMemoryRateLimits(): void {
  memoryBuckets.clear();
}
