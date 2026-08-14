import {
  _resetAppointments,
  bookAppointment,
  BookingError,
  getAvailability,
  isSlotAvailable,
  listAppointments,
} from '../src/domain/booking';
import { quotePrice } from '../src/domain/pricing';
import { getSalon, getService } from '../src/domain/salonService';

const salon = getSalon('salon_glow')!;
const service = getService('svc_silk_press')!; // 90 min duration
const date = '2026-08-01';

describe('booking & availability', () => {
  beforeEach(() => _resetAppointments());

  it('generates slots within salon hours', () => {
    const slots = getAvailability(salon, service, date);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.available)).toBe(true);
    const hours = slots.map((s) => parseInt(s.time, 10));
    expect(Math.min(...hours)).toBeGreaterThanOrEqual(salon.openHour);
    expect(Math.max(...hours)).toBeLessThan(salon.closeHour);
  });

  it('books an appointment and marks the slot unavailable', () => {
    const quote = quotePrice({ salon, service });
    const time = getAvailability(salon, service, date)[0].time;
    const appt = bookAppointment({
      salon,
      service,
      customerName: 'Aisha',
      customerPhone: '254700000000',
      date,
      time,
      mobile: false,
      quote,
    });
    expect(appt.id).toMatch(/^apt_/);
    expect(isSlotAvailable(salon, service, date, time)).toBe(false);
    expect(listAppointments('254700000000')).toHaveLength(1);
  });

  it('rejects double booking of the same slot', () => {
    const quote = quotePrice({ salon, service });
    const time = getAvailability(salon, service, date)[0].time;
    const base = {
      salon,
      service,
      customerName: 'A',
      customerPhone: '111',
      date,
      time,
      mobile: false,
      quote,
    };
    bookAppointment(base);
    expect(() => bookAppointment({ ...base, customerName: 'B', customerPhone: '222' })).toThrow(
      BookingError,
    );
  });
});
