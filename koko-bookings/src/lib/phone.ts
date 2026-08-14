/**
 * Zambian mobile numbers.
 *
 * Everything is stored in E.164 (`+260977123456`) so lookups always match,
 * and displayed grouped (`+260 977 123 456`) because that is how customers
 * read their own number.
 */

const ZM_COUNTRY_CODE = "260";
const ZM_MOBILE_PATTERN = /^[79]\d{8}$/; // Airtel/MTN/Zamtel national numbers

export function normalisePhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (!digits) return null;

  let national = digits;
  if (national.startsWith(ZM_COUNTRY_CODE)) {
    national = national.slice(ZM_COUNTRY_CODE.length);
  } else if (national.startsWith("0")) {
    national = national.slice(1);
  }

  if (!ZM_MOBILE_PATTERN.test(national)) return null;
  return `+${ZM_COUNTRY_CODE}${national}`;
}

export function isValidZambianMobile(input: string): boolean {
  return normalisePhone(input) !== null;
}

/** `+260 977 123 456` */
export function formatPhone(e164: string): string {
  const match = /^\+260(\d{3})(\d{3})(\d{3})$/.exec(e164);
  if (!match) return e164;
  return `+260 ${match[1]} ${match[2]} ${match[3]}`;
}

/** Which network a number belongs to — used for mobile-money hints. */
export function detectMobileMoneyProvider(
  e164: string,
): "airtel" | "mtn" | "zamtel" | null {
  const match = /^\+260(\d{2})/.exec(e164);
  if (!match) return null;
  const prefix = match[1];
  if (["97", "77"].includes(prefix)) return "airtel";
  if (["96", "76"].includes(prefix)) return "mtn";
  if (["95", "75"].includes(prefix)) return "zamtel";
  return null;
}

export const MOBILE_MONEY_PROVIDERS = [
  { id: "airtel", name: "Airtel Money", prefixes: "097 / 077" },
  { id: "mtn", name: "MTN MoMo", prefixes: "096 / 076" },
  { id: "zamtel", name: "Zamtel Kwacha", prefixes: "095 / 075" },
] as const;

export type MobileMoneyProviderId = (typeof MOBILE_MONEY_PROVIDERS)[number]["id"];
