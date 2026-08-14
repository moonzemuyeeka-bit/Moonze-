/**
 * Money handling for BuildLink Zambia.
 *
 * Every monetary value in the system is an integer number of **ngwee** (minor
 * units, 1 ZMW = 100 ngwee). Integers keep totals exact — a float `0.1 + 0.2`
 * drift is unacceptable when a customer is reconciling a construction budget.
 *
 * Per-field values are capped at ZMW 20,000,000.00 (2e9 ngwee) so they always
 * fit in a PostgreSQL INTEGER. Aggregates are summed in JavaScript, where the
 * safe-integer ceiling (9.007e15 ngwee ≈ ZMW 90 trillion) is far beyond any
 * plausible platform total.
 */

export const MINOR_UNITS_PER_KWACHA = 100;

/** Largest amount accepted in a single field: ZMW 20,000,000.00. */
export const MAX_AMOUNT_MINOR = 2_000_000_000;

export const CURRENCY_CODE = "ZMW";

const groupedFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const wholeFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export type FormatZmwOptions = {
  /** Drop the `.00` when the amount has no ngwee component. */
  compactDecimals?: boolean;
  /** Render without the `ZMW ` prefix (for table cells that head the column). */
  omitCurrency?: boolean;
};

/**
 * The single formatting path for money in the product: `ZMW 12,500.00`.
 *
 * A fixed `en-US` grouping locale is used deliberately rather than the runtime
 * default, so a server in one region and a browser in another never disagree
 * about separators (which would cause hydration mismatches).
 */
export function formatZmw(minor: number, options: FormatZmwOptions = {}): string {
  const safe = Number.isFinite(minor) ? Math.round(minor) : 0;
  const kwacha = safe / MINOR_UNITS_PER_KWACHA;
  const useWhole = options.compactDecimals === true && safe % MINOR_UNITS_PER_KWACHA === 0;
  const body = useWhole ? wholeFormatter.format(kwacha) : groupedFormatter.format(kwacha);
  return options.omitCurrency ? body : `${CURRENCY_CODE} ${body}`;
}

/** Short form for dashboard tiles: `ZMW 650k`, `ZMW 1.2m`. */
export function formatZmwShort(minor: number): string {
  const kwacha = Math.round(minor) / MINOR_UNITS_PER_KWACHA;
  const abs = Math.abs(kwacha);
  if (abs >= 1_000_000) {
    return `${CURRENCY_CODE} ${trimZero(kwacha / 1_000_000)}m`;
  }
  if (abs >= 10_000) {
    return `${CURRENCY_CODE} ${trimZero(kwacha / 1_000)}k`;
  }
  return formatZmw(minor, { compactDecimals: true });
}

function trimZero(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Kwacha (possibly fractional) to exact ngwee. */
export function toMinor(kwacha: number): number {
  return Math.round(kwacha * MINOR_UNITS_PER_KWACHA);
}

/** Ngwee to kwacha as a float — for chart axes and CSV export only. */
export function toKwacha(minor: number): number {
  return Math.round(minor) / MINOR_UNITS_PER_KWACHA;
}

/**
 * Parses user input such as `"12,500"`, `"12500.50"`, `"ZMW 12 500"`.
 * Returns ngwee, or `null` when the input is not a usable amount.
 */
export function parseKwachaInput(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") {
    return Number.isFinite(input) ? toMinor(input) : null;
  }

  const cleaned = input
    .replace(/zmw/gi, "")
    .replace(/k(?=\s*$)/i, "")
    .replace(/[,\s\u00a0]/g, "")
    .trim();

  if (cleaned === "" || !/^-?\d*(\.\d{0,2})?$/.test(cleaned)) return null;

  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return toMinor(value);
}

export function sumMinor(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

/** Applies a basis-point rate (1 bps = 0.01%), rounding half-up to the ngwee. */
export function applyBasisPoints(minor: number, basisPoints: number): number {
  return Math.round((minor * basisPoints) / 10_000);
}

export function basisPointsToPercent(basisPoints: number): number {
  return basisPoints / 100;
}

export function percentToBasisPoints(percent: number): number {
  return Math.round(percent * 100);
}

/** Star rating stored as basis points (5.00 stars == 50000 bps). */
export function ratingFromBasisPoints(basisPoints: number): number {
  return Math.round(basisPoints / 100) / 100;
}

export function ratingToBasisPoints(stars: number): number {
  return Math.round(stars * 10_000);
}

export function formatRating(basisPoints: number): string {
  return ratingFromBasisPoints(basisPoints).toFixed(1);
}

/**
 * Share of `part` in `whole`, clamped to 0–100 and rounded to a whole percent.
 * Used for budget-consumed bars and project progress.
 */
export function percentageOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((part / whole) * 100)));
}

export function isValidAmountMinor(minor: number): boolean {
  return Number.isInteger(minor) && minor >= 0 && minor <= MAX_AMOUNT_MINOR;
}
