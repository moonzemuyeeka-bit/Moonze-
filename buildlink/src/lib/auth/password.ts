import "server-only";
import bcrypt from "bcryptjs";
import { env } from "@/lib/env";

/**
 * Password hashing.
 *
 * bcrypt is used rather than a native argon2 binding so the same code runs on
 * Vercel's serverless runtime without a build step. The cost factor is
 * configurable (`BCRYPT_COST`) so production can use 12 while test suites drop
 * to 4 and stay fast.
 *
 * The policy helpers live in `./password-policy` because forms need them on the
 * client.
 */

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, env.BCRYPT_COST);
}

export async function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plainText, hash);
  } catch {
    return false;
  }
}
