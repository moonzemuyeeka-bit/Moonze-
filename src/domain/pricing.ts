import { PriceLineItem, PriceQuote, PriceQuoteInput } from './types';

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Build a transparent, line-item price quote applying, in order:
 *  1. mobile "come-to-you" markup (surcharge)
 *  2. pre-booking discount
 *  3. verified-student discount
 *
 * Discounts stack additively on the base price so the customer can clearly
 * see the value of each perk. Student discount only applies when proof has
 * been verified.
 */
export function quotePrice(input: PriceQuoteInput): PriceQuote {
  const { salon, service } = input;
  const lineItems: PriceLineItem[] = [];
  const notes: string[] = [];

  const basePrice = service.basePrice;

  if (input.mobile) {
    if (salon.offersMobile) {
      const surcharge = round(basePrice * salon.mobileMarkup);
      lineItems.push({
        label: `Mobile (come-to-you) service +${Math.round(salon.mobileMarkup * 100)}%`,
        amount: surcharge,
      });
    } else {
      notes.push(`${salon.name} does not currently offer mobile/come-to-you service.`);
    }
  }

  if (input.prebooking && salon.prebookingDiscount > 0) {
    const discount = round(basePrice * salon.prebookingDiscount);
    lineItems.push({
      label: `Pre-booking discount -${Math.round(salon.prebookingDiscount * 100)}%`,
      amount: -discount,
    });
  }

  if (input.isStudent) {
    if (input.studentProofVerified && salon.studentDiscount > 0) {
      const discount = round(basePrice * salon.studentDiscount);
      lineItems.push({
        label: `Student discount -${Math.round(salon.studentDiscount * 100)}%`,
        amount: -discount,
      });
    } else if (!input.studentProofVerified) {
      notes.push(
        'Student discount available on proof (upload a valid student ID or use a .edu / school email).',
      );
    }
  }

  const total = round(
    lineItems.reduce((sum, item) => sum + item.amount, basePrice),
  );

  return {
    currency: salon.currency,
    basePrice,
    lineItems,
    total,
    notes,
  };
}

/** Simple heuristic: treat an email ending in .edu / .ac.* or "student" text as proof. */
export function looksLikeStudentProof(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /\.edu\b/.test(t) ||
    /\.ac\.[a-z]{2,}/.test(t) ||
    /student\s*(id|number|card)/.test(t)
  );
}
