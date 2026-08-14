import { describe, expect, it } from "vitest";
import { computeBookingAmounts } from "@/lib/booking/pricing";
import { formatKwacha } from "@/lib/money";

const DEPOSIT = 5_000; // K50

describe("deposit and balance", () => {
  it("takes a K50 deposit and leaves the rest to settle at the appointment", () => {
    expect(computeBookingAmounts(28_000, DEPOSIT)).toEqual({
      totalNgwee: 28_000,
      depositNgwee: 5_000,
      remainingNgwee: 23_000,
    });
  });

  it.each([
    ["Classic Lashes", 28_000, "K280", "K50", "K230"],
    ["Manga Sets", 35_000, "K350", "K50", "K300"],
    ["Volume", 50_000, "K500", "K50", "K450"],
    ["Lash Removal", 10_000, "K100", "K50", "K50"],
  ])("%s: %s total, %s today, %s balance", (_name, price, total, deposit, balance) => {
    const amounts = computeBookingAmounts(price, DEPOSIT);
    expect(formatKwacha(amounts.totalNgwee)).toBe(total);
    expect(formatKwacha(amounts.depositNgwee)).toBe(deposit);
    expect(formatKwacha(amounts.remainingNgwee)).toBe(balance);
  });

  it("never charges a deposit larger than the service price", () => {
    expect(computeBookingAmounts(4_000, DEPOSIT)).toEqual({
      totalNgwee: 4_000,
      depositNgwee: 4_000,
      remainingNgwee: 0,
    });
  });

  it("follows a changed deposit setting", () => {
    expect(computeBookingAmounts(28_000, 10_000).remainingNgwee).toBe(18_000);
  });

  it("rejects negative amounts", () => {
    expect(() => computeBookingAmounts(-1, DEPOSIT)).toThrow();
    expect(() => computeBookingAmounts(28_000, -1)).toThrow();
  });
});
