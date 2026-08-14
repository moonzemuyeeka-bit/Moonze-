import { RateLimitError } from "@/lib/errors";

/**
 * Small fixed-window rate limiter held in process memory. Enough to stop
 * accidental double-submits, reference guessing and password spraying on a
 * single instance; swap for Redis/Upstash when running more than one.
 */

type Bucket = { count: number; resetAt: number };

const store = globalThis as unknown as { __kokoRateLimit?: Map<string, Bucket> };
store.__kokoRateLimit ??= new Map<string, Bucket>();
const buckets = store.__kokoRateLimit;

export type RateLimitRule = { limit: number; windowMs: number };

export const RATE_LIMITS = {
  createBooking: { limit: 8, windowMs: 60_000 },
  initiatePayment: { limit: 15, windowMs: 60_000 },
  lookupBooking: { limit: 10, windowMs: 60_000 },
  adminLogin: { limit: 6, windowMs: 5 * 60_000 },
  sandboxSettle: { limit: 30, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitRule>;

export function consumeRateLimit(key: string, rule: RateLimitRule): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    if (buckets.size > 5_000) pruneExpired(now);
    return;
  }

  if (bucket.count >= rule.limit) {
    const seconds = Math.ceil((bucket.resetAt - now) / 1000);
    throw new RateLimitError(
      `Too many attempts. Please try again in ${seconds} second${seconds === 1 ? "" : "s"}.`,
    );
  }
  bucket.count += 1;
}

export function resetRateLimits(): void {
  buckets.clear();
}

function pruneExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/** Best-effort client identity for rate limiting. */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return `${scope}:${ip}`;
}
