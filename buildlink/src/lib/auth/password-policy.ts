/**
 * Password policy. Deliberately length-first rather than a thicket of character
 * classes: length is the property that actually resists guessing, and awkward
 * rules push people towards `Password1!`.
 *
 * This module is import-safe from client components, so it must not touch env,
 * bcrypt or anything else server-only.
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
