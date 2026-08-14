import type { BookingAmounts } from "@/types";

/**
 * The customer pays a fixed deposit online today; the rest is settled at the
 * appointment. Deposits never exceed the service price (a K100 lash removal
 * with a K50 deposit still leaves a K50 balance, but a hypothetical K40
 * service would simply be paid in full).
 */
export function computeBookingAmounts(
  servicePriceNgwee: number,
  depositNgwee: number,
): BookingAmounts {
  if (servicePriceNgwee < 0 || depositNgwee < 0) {
    throw new Error("Amounts cannot be negative");
  }

  const deposit = Math.min(depositNgwee, servicePriceNgwee);
  return {
    totalNgwee: servicePriceNgwee,
    depositNgwee: deposit,
    remainingNgwee: servicePriceNgwee - deposit,
  };
}
