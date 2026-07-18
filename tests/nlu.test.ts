import { detectIntent, extractServiceQuery } from '../src/ai/nlu';

describe('NLU', () => {
  it('extracts service queries from free text', () => {
    expect(extractServiceQuery('I want box braids')).toBe('box braids');
    expect(extractServiceQuery('need a gel manicure')).toBe('gel manicure');
    expect(extractServiceQuery('hello there')).toBeUndefined();
  });

  it('parses HH:MM time without confusing it with the date', () => {
    const nlu = detectIntent('book it for 2026-08-05 at 14:00');
    expect(nlu.date).toBe('2026-08-05');
    expect(nlu.time).toBe('14:00');
  });

  it('parses am/pm times', () => {
    expect(detectIntent('tomorrow 10am').time).toBe('10:00');
    expect(detectIntent('book 2pm').time).toBe('14:00');
    expect(detectIntent('at 12am').time).toBe('00:00');
  });

  it('does not treat a bare selection number as a time', () => {
    expect(detectIntent('1').time).toBeUndefined();
    expect(detectIntent('2').time).toBeUndefined();
  });

  it('classifies core intents', () => {
    expect(detectIntent('find knotless braids near me').intent).toBe('find_salon');
    expect(detectIntent('what times are available?').intent).toBe('availability');
    expect(detectIntent('how much does it cost').intent).toBe('pricing');
    expect(detectIntent('recommend a similar salon').intent).toBe('recommend');
    expect(detectIntent('how do I get there by uber').intent).toBe('transport');
    expect(detectIntent('do you have a student discount').intent).toBe('student_discount');
    expect(detectIntent('yes').intent).toBe('affirm');
    expect(detectIntent('no').intent).toBe('deny');
  });

  it('detects mobile and pre-booking flags', () => {
    const n = detectIntent('can you come to my place if I pre-book?');
    expect(n.mobile).toBe(true);
    expect(n.prebooking).toBe(true);
  });
});
