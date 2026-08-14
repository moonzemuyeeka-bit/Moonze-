import { randomInt } from "node:crypto";

/**
 * Public booking references (`KOKO-8F42A1`).
 *
 * Random rather than sequential so nothing about the business (order volume,
 * internal ids) leaks, and drawn from Crockford's base32 alphabet — I, L, O and
 * U are omitted, which removes the pairs customers confuse when reading a
 * reference out over the phone.
 */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const REFERENCE_LENGTH = 6;
export const REFERENCE_PREFIX = "KOKO";

export function generateBookingReference(): string {
  let code = "";
  for (let index = 0; index < REFERENCE_LENGTH; index += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `${REFERENCE_PREFIX}-${code}`;
}

export function isBookingReference(value: string): boolean {
  return new RegExp(`^${REFERENCE_PREFIX}-[${ALPHABET}]{${REFERENCE_LENGTH}}$`).test(
    value.trim().toUpperCase(),
  );
}

export function normaliseBookingReference(value: string): string {
  const trimmed = value.trim().toUpperCase().replace(/\s+/g, "");
  if (trimmed.startsWith(`${REFERENCE_PREFIX}-`)) return trimmed;
  if (trimmed.startsWith(REFERENCE_PREFIX)) {
    return `${REFERENCE_PREFIX}-${trimmed.slice(REFERENCE_PREFIX.length)}`;
  }
  return `${REFERENCE_PREFIX}-${trimmed}`;
}

/**
 * Draws references until an unused one is found. Six random characters give
 * ~1 billion combinations, so a collision is a curiosity, not a hot path.
 */
export async function generateUniqueBookingReference(
  exists: (reference: string) => Promise<boolean>,
  maxAttempts = 10,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const reference = generateBookingReference();
    if (!(await exists(reference))) return reference;
  }
  throw new Error("Could not generate a unique booking reference");
}
