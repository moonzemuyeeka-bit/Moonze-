import { describe, expect, it } from "vitest";
import {
  generateBookingReference,
  generateUniqueBookingReference,
  isBookingReference,
  normaliseBookingReference,
} from "@/lib/booking/reference";

describe("booking references", () => {
  it("looks like KOKO-8F42A1", () => {
    expect(generateBookingReference()).toMatch(/^KOKO-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
    expect(isBookingReference("KOKO-8F42A1")).toBe(true);
  });

  it("avoids look-alike characters customers misread over the phone", () => {
    const codes = Array.from({ length: 400 }, () => generateBookingReference().slice(5));
    expect(codes.join("")).not.toMatch(/[ILOU]/);
  });

  it("is unlikely to repeat", () => {
    const references = new Set(Array.from({ length: 2_000 }, generateBookingReference));
    expect(references.size).toBeGreaterThan(1_990);
  });

  it("accepts what a customer is likely to type", () => {
    expect(normaliseBookingReference(" koko-8f42a1 ")).toBe("KOKO-8F42A1");
    expect(normaliseBookingReference("KOKO8F42A1")).toBe("KOKO-8F42A1");
    expect(normaliseBookingReference("8f42a1")).toBe("KOKO-8F42A1");
  });

  it("validates the reference shape", () => {
    expect(isBookingReference("koko-8f42a1")).toBe(true);
    expect(isBookingReference("KOKO-8F42A")).toBe(false);
    expect(isBookingReference("KOKO-8F42AI")).toBe(false);
    expect(isBookingReference("cktz9r2k00001")).toBe(false);
  });

  it("draws again when a reference is already taken", async () => {
    let calls = 0;
    const reference = await generateUniqueBookingReference(async () => {
      calls += 1;
      return calls < 3;
    });
    expect(calls).toBe(3);
    expect(isBookingReference(reference)).toBe(true);
  });

  it("gives up rather than issuing a duplicate", async () => {
    await expect(generateUniqueBookingReference(async () => true, 3)).rejects.toThrow(
      /unique booking reference/i,
    );
  });
});
