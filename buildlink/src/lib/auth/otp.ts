import "server-only";
import { createHash, randomInt } from "node:crypto";
import type { OtpPurpose } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError, ConfigurationError, ValidationError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { safeCompare } from "@/lib/auth/session";
import { configuredChannels } from "@/lib/services/notifications";

/**
 * One-time-code plumbing for phone verification.
 *
 * The challenge lifecycle — issue, hash, expire, limit attempts, consume — is
 * fully implemented, because that is the part that has to be right. Delivery is
 * not: no SMS provider ships with BuildLink, so `requestOtp` reports that the
 * channel is unconfigured instead of pretending a code was sent. Wiring an
 * aggregator into `lib/services/notifications.ts` is all that stands between
 * this and working phone verification.
 */

const CODE_LENGTH = 6;
const TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function hashCode(code: string, destination: string): string {
  return createHash("sha256").update(`${destination}.${code}.${env.AUTH_SECRET}`).digest("hex");
}

function generateCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

export type OtpRequestResult = {
  challengeId: string;
  expiresAt: Date;
  delivered: boolean;
  /** Present only in development, so the flow is testable without an SMS provider. */
  developmentCode?: string;
};

export async function requestOtp(input: {
  destination: string;
  purpose: OtpPurpose;
  userId?: string | null;
}): Promise<OtpRequestResult> {
  await enforceRateLimit("otpRequest", input.destination);

  const code = generateCode();
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);

  // Any outstanding challenge for the same destination and purpose is retired,
  // so an old code can never be replayed after a resend.
  await db.otpChallenge.updateMany({
    where: { destination: input.destination, purpose: input.purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const challenge = await db.otpChallenge.create({
    data: {
      destination: input.destination,
      purpose: input.purpose,
      userId: input.userId ?? null,
      codeHash: hashCode(code, input.destination),
      expiresAt,
    },
  });

  const smsConfigured = configuredChannels().includes("SMS");

  if (!smsConfigured) {
    console.info(
      `[buildlink] SMS channel not configured; verification code for ${input.destination} was not sent.`,
    );
    return {
      challengeId: challenge.id,
      expiresAt,
      delivered: false,
      ...(env.NODE_ENV === "development" ? { developmentCode: code } : {}),
    };
  }

  throw new ConfigurationError(
    "An SMS driver is configured but no adapter is implemented yet. Add one in lib/services/notifications.ts.",
  );
}

export async function verifyOtp(input: {
  challengeId: string;
  code: string;
}): Promise<{ destination: string; purpose: OtpPurpose; userId: string | null }> {
  const challenge = await db.otpChallenge.findUnique({ where: { id: input.challengeId } });

  if (!challenge || challenge.consumedAt !== null) {
    throw new ValidationError("That code is no longer valid. Request a new one.", {
      code: ["Expired or already used."],
    });
  }

  if (challenge.expiresAt.getTime() < Date.now()) {
    throw new ValidationError("That code has expired. Request a new one.", {
      code: ["Code expired."],
    });
  }

  if (challenge.attempts >= MAX_ATTEMPTS) {
    throw new AppError("Too many incorrect attempts. Request a new code.", {
      code: "OTP_LOCKED",
      statusCode: 429,
    });
  }

  const expected = hashCode(input.code.trim(), challenge.destination);
  if (!safeCompare(expected, challenge.codeHash)) {
    await db.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    throw new ValidationError("That code is not correct.", { code: ["Incorrect code."] });
  }

  await db.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });

  return {
    destination: challenge.destination,
    purpose: challenge.purpose,
    userId: challenge.userId,
  };
}

/** Housekeeping for stale challenges. */
export async function pruneOtpChallenges(): Promise<number> {
  const result = await db.otpChallenge.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  return result.count;
}
