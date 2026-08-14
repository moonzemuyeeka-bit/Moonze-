/**
 * All money in Koko's Bookings is stored and passed around as integer ngwee
 * (1 Kwacha = 100 ngwee) so arithmetic on deposits and balances is exact.
 */

export const NGWEE_PER_KWACHA = 100;

export function toNgwee(kwacha: number): number {
  return Math.round(kwacha * NGWEE_PER_KWACHA);
}

export function toKwacha(ngwee: number): number {
  return ngwee / NGWEE_PER_KWACHA;
}

/**
 * Formats ngwee the Zambian way: `K280`, `K3,400`, `K1,250.50`.
 * Whole amounts drop the decimals to keep the interface calm.
 */
export function formatKwacha(
  ngwee: number,
  options: { alwaysShowDecimals?: boolean; from?: boolean } = {},
): string {
  const negative = ngwee < 0;
  const absolute = Math.abs(ngwee);
  const kwacha = Math.floor(absolute / NGWEE_PER_KWACHA);
  const remainder = absolute % NGWEE_PER_KWACHA;
  const showDecimals = options.alwaysShowDecimals || remainder !== 0;

  const formatted = showDecimals
    ? `${kwacha.toLocaleString("en-ZM")}.${remainder.toString().padStart(2, "0")}`
    : kwacha.toLocaleString("en-ZM");

  return `${options.from ? "From " : ""}${negative ? "-" : ""}K${formatted}`;
}

/** `K280.00 (ZMW)` style label for receipts and exports. */
export function formatKwachaWithCurrency(ngwee: number, currency = "ZMW"): string {
  return `${formatKwacha(ngwee, { alwaysShowDecimals: true })} ${currency}`;
}
