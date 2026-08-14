import { Appointment, AppointmentSlot, PriceQuote, Salon, Service } from './types';

/** In-memory appointment store. Swap for a DB in production. */
const appointments: Appointment[] = [];

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Generate slots for a given date based on salon hours and service duration.
 * Slots already taken by existing appointments are marked unavailable.
 */
export function getAvailability(salon: Salon, service: Service, date: string): AppointmentSlot[] {
  const slots: AppointmentSlot[] = [];
  const stepHours = Math.max(1, Math.ceil(service.durationMinutes / 60));
  const taken = new Set(
    appointments
      .filter((a) => a.salonId === salon.id && a.date === date)
      .map((a) => a.time),
  );

  for (let hour = salon.openHour; hour + stepHours <= salon.closeHour; hour += stepHours) {
    const time = `${pad(hour)}:00`;
    slots.push({ date, time, available: !taken.has(time) });
  }
  return slots;
}

export function isSlotAvailable(salon: Salon, service: Service, date: string, time: string): boolean {
  return getAvailability(salon, service, date).some((s) => s.time === time && s.available);
}

export interface BookingRequest {
  salon: Salon;
  service: Service;
  customerName: string;
  customerPhone: string;
  date: string;
  time: string;
  mobile: boolean;
  quote: PriceQuote;
}

export class BookingError extends Error {}

export function bookAppointment(req: BookingRequest): Appointment {
  if (!isSlotAvailable(req.salon, req.service, req.date, req.time)) {
    throw new BookingError(`Sorry, ${req.time} on ${req.date} is no longer available.`);
  }
  const appointment: Appointment = {
    id: `apt_${Date.now()}_${Math.floor(Math.random() * 1e4)}`,
    salonId: req.salon.id,
    serviceId: req.service.id,
    customerName: req.customerName,
    customerPhone: req.customerPhone,
    date: req.date,
    time: req.time,
    mobile: req.mobile,
    quote: req.quote,
    createdAt: new Date().toISOString(),
  };
  appointments.push(appointment);
  return appointment;
}

export function listAppointments(customerPhone?: string): Appointment[] {
  return customerPhone
    ? appointments.filter((a) => a.customerPhone === customerPhone)
    : [...appointments];
}

/** Test helper to reset state between runs. */
export function _resetAppointments(): void {
  appointments.length = 0;
}
