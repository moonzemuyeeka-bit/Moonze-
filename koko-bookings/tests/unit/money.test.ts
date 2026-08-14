import { describe, expect, it } from "vitest";
import { formatKwacha, formatKwachaWithCurrency, toKwacha, toNgwee } from "@/lib/money";

describe("money", () => {
  it("converts kwacha to integer ngwee without floating point drift", () => {
    expect(toNgwee(280)).toBe(28_000);
    expect(toNgwee(50)).toBe(5_000);
    expect(toNgwee(12.35)).toBe(1_235);
    expect(toNgwee(0.1 + 0.2)).toBe(30);
  });

  it("converts back to kwacha", () => {
    expect(toKwacha(28_000)).toBe(280);
    expect(toKwacha(1_235)).toBe(12.35);
  });

  it("formats prices the Zambian way", () => {
    expect(formatKwacha(28_000)).toBe("K280");
    expect(formatKwacha(50_000)).toBe("K500");
    expect(formatKwacha(5_000)).toBe("K50");
    expect(formatKwacha(340_000)).toBe("K3,400");
  });

  it("keeps ngwee when an amount is not whole", () => {
    expect(formatKwacha(125_050)).toBe("K1,250.50");
    expect(formatKwacha(28_000, { alwaysShowDecimals: true })).toBe("K280.00");
  });

  it("supports 'from' pricing and negative amounts", () => {
    expect(formatKwacha(28_000, { from: true })).toBe("From K280");
    expect(formatKwacha(-5_000)).toBe("-K50");
  });

  it("labels receipts with the currency", () => {
    expect(formatKwachaWithCurrency(5_000)).toBe("K50.00 ZMW");
  });
});
