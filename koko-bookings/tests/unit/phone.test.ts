import { describe, expect, it } from "vitest";
import {
  detectMobileMoneyProvider,
  formatPhone,
  isValidZambianMobile,
  normalisePhone,
} from "@/lib/phone";

describe("Zambian mobile numbers", () => {
  it.each([
    "0977123456",
    "+260977123456",
    "260977123456",
    "+260 977 123 456",
    "097-712-3456",
  ])("normalises %s to E.164", (input) => {
    expect(normalisePhone(input)).toBe("+260977123456");
  });

  it.each([
    ["", "empty"],
    ["0977123", "too short"],
    ["09771234567", "too long"],
    ["0812345678", "not a mobile prefix"],
    ["+447700900000", "not Zambian"],
  ])("rejects %s (%s)", (input) => {
    expect(normalisePhone(input)).toBeNull();
    expect(isValidZambianMobile(input)).toBe(false);
  });

  it("displays numbers grouped the way customers read them", () => {
    expect(formatPhone("+260977123456")).toBe("+260 977 123 456");
  });

  it("maps a number to its mobile money wallet", () => {
    expect(detectMobileMoneyProvider("+260977123456")).toBe("airtel");
    expect(detectMobileMoneyProvider("+260966123456")).toBe("mtn");
    expect(detectMobileMoneyProvider("+260955123456")).toBe("zamtel");
    expect(detectMobileMoneyProvider("+260911123456")).toBeNull();
  });
});
