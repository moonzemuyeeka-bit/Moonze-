import { quotePrice, looksLikeStudentProof } from '../src/domain/pricing';
import { getSalon, getService } from '../src/domain/salonService';

const salon = getSalon('salon_glow')!; // mobileMarkup .25, prebook .1, student .15
const service = getService('svc_knotless_braids')!; // base 4500

describe('pricing engine', () => {
  it('returns base price with no options', () => {
    const q = quotePrice({ salon, service });
    expect(q.total).toBe(4500);
    expect(q.lineItems).toHaveLength(0);
  });

  it('adds mobile markup as a surcharge', () => {
    const q = quotePrice({ salon, service, mobile: true });
    expect(q.total).toBe(4500 + 4500 * 0.25);
    expect(q.lineItems[0].amount).toBeGreaterThan(0);
  });

  it('applies pre-booking discount', () => {
    const q = quotePrice({ salon, service, prebooking: true });
    expect(q.total).toBe(4500 - 4500 * 0.1);
  });

  it('applies student discount only when proof is verified', () => {
    const noProof = quotePrice({ salon, service, isStudent: true });
    expect(noProof.total).toBe(4500);
    expect(noProof.notes.join(' ')).toMatch(/proof/i);

    const withProof = quotePrice({ salon, service, isStudent: true, studentProofVerified: true });
    expect(withProof.total).toBe(4500 - 4500 * 0.15);
  });

  it('stacks mobile markup with pre-booking and student discounts', () => {
    const q = quotePrice({
      salon,
      service,
      mobile: true,
      prebooking: true,
      isStudent: true,
      studentProofVerified: true,
    });
    const expected = 4500 + 4500 * 0.25 - 4500 * 0.1 - 4500 * 0.15;
    expect(q.total).toBe(expected);
    expect(q.lineItems).toHaveLength(3);
  });

  it('notes when a salon does not offer mobile', () => {
    const noMobileSalon = getSalon('salon_serenity')!;
    const svc = getService('svc_silk_press')!;
    const q = quotePrice({ salon: noMobileSalon, service: svc, mobile: true });
    expect(q.notes.join(' ')).toMatch(/does not currently offer mobile/i);
    expect(q.total).toBe(svc.basePrice);
  });

  it('detects student proof heuristics', () => {
    expect(looksLikeStudentProof('my email is jane@uni.ac.ke')).toBe(true);
    expect(looksLikeStudentProof('jane@school.edu')).toBe(true);
    expect(looksLikeStudentProof('student id 12345')).toBe(true);
    expect(looksLikeStudentProof('just a normal message')).toBe(false);
  });
});
