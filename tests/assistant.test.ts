import { Assistant } from '../src/ai/assistant';
import { loadConfig } from '../src/config';
import { _resetAppointments } from '../src/domain/booking';

function makeAssistant(): Assistant {
  // No OPENAI_API_KEY => deterministic rule-based engine.
  return new Assistant(loadConfig({ PORT: '0' } as NodeJS.ProcessEnv));
}

describe('Assistant conversation', () => {
  beforeEach(() => _resetAppointments());

  it('greets and explains capabilities', async () => {
    const a = makeAssistant();
    const r = await a.handle({ sessionId: 's1', text: 'hi' });
    expect(r.engine).toBe('rules');
    expect(r.text).toMatch(/Moonze/);
    expect(r.text).toMatch(/hairdo|service/i);
  });

  it('finds salons for a requested hairdo', async () => {
    const a = makeAssistant();
    const r = await a.handle({ sessionId: 's2', text: 'find me knotless braids near me' });
    expect(r.text).toMatch(/Knotless Braids/);
    expect(r.cards?.some((c) => c.type === 'salon')).toBe(true);
  });

  it('sorts by distance when location provided', async () => {
    const a = makeAssistant();
    const r = await a.handle({
      sessionId: 's3',
      text: 'box braids near me',
      location: { lat: -1.3031, lng: 36.7073 }, // Karen -> Afro Crown closest
    });
    const first = r.cards?.find((c) => c.type === 'salon') as any;
    expect(first.name).toBe('Afro Crown Braiders');
  });

  it('quotes pricing with mobile markup for a selected salon', async () => {
    const a = makeAssistant();
    await a.handle({ sessionId: 's4', text: 'silk press' });
    await a.handle({ sessionId: 's4', text: '1' }); // select first salon
    const r = await a.handle({ sessionId: 's4', text: 'how much for mobile service?' });
    const card = r.cards?.find((c) => c.type === 'quote') as any;
    expect(card).toBeDefined();
    expect(card.quote.lineItems.some((li: any) => /Mobile/.test(li.label))).toBe(true);
  });

  it('explains and unlocks student discount on proof', async () => {
    const a = makeAssistant();
    await a.handle({ sessionId: 's5', text: 'knotless braids' });
    await a.handle({ sessionId: 's5', text: '1' });
    const ask = await a.handle({ sessionId: 's5', text: 'do you have a student discount?' });
    expect(ask.text).toMatch(/proof/i);
    const proof = await a.handle({ sessionId: 's5', text: 'my email is jane@uni.ac.ke' });
    expect(proof.text).toMatch(/verified/i);
    const quote = await a.handle({ sessionId: 's5', text: 'price please' });
    const card = quote.cards?.find((c) => c.type === 'quote') as any;
    expect(card.quote.lineItems.some((li: any) => /Student/.test(li.label))).toBe(true);
  });

  it('plans transport including late return', async () => {
    const a = makeAssistant();
    await a.handle({ sessionId: 's6', text: 'silk press' });
    await a.handle({ sessionId: 's6', text: '1' });
    const r = await a.handle({ sessionId: 's6', text: 'how do I get there? I finish late' });
    const card = r.cards?.find((c) => c.type === 'transport') as any;
    expect(card).toBeDefined();
    expect(card.plan.options.length).toBeGreaterThan(0);
  });

  it('recommends similar salons', async () => {
    const a = makeAssistant();
    await a.handle({ sessionId: 's7', text: 'box braids' });
    await a.handle({ sessionId: 's7', text: '1' });
    const r = await a.handle({ sessionId: 's7', text: 'recommend a similar salon' });
    expect(r.cards?.some((c) => c.type === 'salon')).toBe(true);
  });

  it('guides the customer to real open times when an unavailable slot is picked', async () => {
    const a = makeAssistant();
    await a.handle({ sessionId: 's9', text: 'knotless braids' });
    await a.handle({ sessionId: 's9', text: '3' }); // Afro Crown (long 210-min service)
    const r = await a.handle({ sessionId: 's9', text: 'book it for 2026-08-05 at 14:00' });
    expect(r.text).toMatch(/isn't available/i);
    // The offered open times should not include the invalid 14:00 slot.
    const offered = r.text.split('are:')[1] ?? '';
    expect(offered).not.toMatch(/\b14:00\b/);
  });

  it('completes an end-to-end booking flow', async () => {
    const a = makeAssistant();
    await a.handle({ sessionId: 's8', text: 'silk press' });
    await a.handle({ sessionId: 's8', text: '1' });
    await a.handle({ sessionId: 's8', text: 'book it for 2026-08-05 at 10:00' });
    const nameStep = await a.handle({ sessionId: 's8', text: 'Aisha' });
    expect(nameStep.text).toMatch(/confirm/i);
    const done = await a.handle({ sessionId: 's8', text: 'yes', customerPhone: '254711111111' });
    expect(done.text).toMatch(/Booked/i);
    expect(done.cards?.some((c) => c.type === 'booking')).toBe(true);
  });
});
