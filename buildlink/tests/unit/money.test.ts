import { describe, expect, it } from "vitest";
import {
  applyBasisPoints,
  formatZmw,
  formatZmwShort,
  isValidAmountMinor,
  MAX_AMOUNT_MINOR,
  parseKwachaInput,
  percentageOf,
  ratingFromBasisPoints,
  sumMinor,
  toKwacha,
  toMinor,
} from "@/lib/money";

describe("formatZmw", () => {
  it("renders grouped kwacha with two decimals", () => {
    expect(formatZmw(1_250_000)).toBe("ZMW 12,500.00");
    expect(formatZmw(0)).toBe("ZMW 0.00");
    expect(formatZmw(50)).toBe("ZMW 0.50");
  });

  it("drops decimals only for whole amounts when asked", () => {
    expect(formatZmw(1_250_000, { compactDecimals: true })).toBe("ZMW 12,500");
    expect(formatZmw(1_250_050, { compactDecimals: true })).toBe("ZMW 12,500.50");
  });

  it("omits the currency prefix when asked", () => {
    expect(formatZmw(1_250_000, { omitCurrency: true })).toBe("12,500.00");
  });

  it("survives non-finite input rather than printing NaN", () => {
    expect(formatZmw(Number.NaN)).toBe("ZMW 0.00");
  });
});

describe("formatZmwShort", () => {
  it("abbreviates thousands and millions", () => {
    expect(formatZmwShort(65_000_000)).toBe("ZMW 650k");
    expect(formatZmwShort(120_000_000)).toBe("ZMW 1.2m");
    expect(formatZmwShort(450_000)).toBe("ZMW 4,500");
  });
});

describe("minor unit conversion", () => {
  it("round-trips kwacha through ngwee exactly", () => {
    expect(toMinor(12_500.5)).toBe(1_250_050);
    expect(toKwacha(1_250_050)).toBe(12_500.5);
  });

  it("avoids float drift when summing", () => {
    // 0.1 + 0.2 in floats is 0.30000000000000004; in ngwee it is exact.
    expect(sumMinor([toMinor(0.1), toMinor(0.2)])).toBe(toMinor(0.3));
  });
});

describe("parseKwachaInput", () => {
  it("accepts the shapes people actually type", () => {
    expect(parseKwachaInput("12,500")).toBe(1_250_000);
    expect(parseKwachaInput("12500.50")).toBe(1_250_050);
    expect(parseKwachaInput("ZMW 12 500")).toBe(1_250_000);
    expect(parseKwachaInput(12_500)).toBe(1_250_000);
  });

  it("rejects junk instead of guessing", () => {
    expect(parseKwachaInput("")).toBeNull();
    expect(parseKwachaInput("abc")).toBeNull();
    expect(parseKwachaInput("12.345")).toBeNull();
    expect(parseKwachaInput(null)).toBeNull();
    expect(parseKwachaInput(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("rates and shares", () => {
  it("applies basis points with half-up rounding", () => {
    expect(applyBasisPoints(1_000_000, 500)).toBe(50_000);
    expect(applyBasisPoints(333, 500)).toBe(17);
  });

  it("clamps percentages into 0-100", () => {
    expect(percentageOf(50, 100)).toBe(50);
    expect(percentageOf(150, 100)).toBe(100);
    expect(percentageOf(-5, 100)).toBe(0);
    expect(percentageOf(10, 0)).toBe(0);
  });

  it("converts rating basis points to stars", () => {
    expect(ratingFromBasisPoints(45_000)).toBe(4.5);
    expect(ratingFromBasisPoints(0)).toBe(0);
  });
});

describe("isValidAmountMinor", () => {
  it("accepts whole non-negative amounts within the column ceiling", () => {
    expect(isValidAmountMinor(0)).toBe(true);
    expect(isValidAmountMinor(MAX_AMOUNT_MINOR)).toBe(true);
    expect(isValidAmountMinor(MAX_AMOUNT_MINOR + 1)).toBe(false);
    expect(isValidAmountMinor(-1)).toBe(false);
    expect(isValidAmountMinor(1.5)).toBe(false);
  });
});
