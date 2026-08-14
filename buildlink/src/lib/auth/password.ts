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

/**
 * Password policy. Deliberately length-first rather than a thicket of character
 * classes: length is the property that actually resists guessing, and awkward
 * rules push people towards `Password1!`.
 */
export const PASSWORD_MIN_LENGTH = 10;

const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwertyuiop",
  "buildlink",
  "buildlink123",
  "zambia123",
  "letmein123",
  "iloveyou1",
]);

export function describePasswordProblems(password: string, email?: string): string[] {
  const problems: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    problems.push(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
  if (!/[a-zA-Z]/.test(password)) {
    problems.push("Include at least one letter.");
  }
  if (!/\d/.test(password)) {
    problems.push("Include at least one number.");
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    problems.push("That password is too common — please choose another.");
  }
  if (email) {
    const localPart = email.split("@")[0]?.toLowerCase();
    if (localPart && localPart.length > 2 && password.toLowerCase().includes(localPart)) {
      problems.push("Do not include your email address in your password.");
    }
  }

  return problems;
}
