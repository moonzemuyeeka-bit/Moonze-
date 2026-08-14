import { planTransport } from '../src/domain/transport';
import { getSalon } from '../src/domain/salonService';

describe('transport planning', () => {
  it('lists ride partners with deep links and discounts', () => {
    const plan = planTransport(getSalon('salon_glow')!);
    expect(plan.options.length).toBeGreaterThan(0);
    expect(plan.options[0].deepLink).toMatch(/^https?:\/\//);
    expect(plan.embedded).toBe(true);
  });

  it('flags covered late return when finishing late', () => {
    const plan = planTransport(getSalon('salon_glow')!, true);
    expect(plan.lateReturnCovered).toBe(true);
    expect(plan.summary).toMatch(/covered return ride/i);
  });

  it('warns when late return is not covered', () => {
    const plan = planTransport(getSalon('salon_serenity')!, true);
    expect(plan.lateReturnCovered).toBe(false);
    expect(plan.summary).toMatch(/not available/i);
  });
});
