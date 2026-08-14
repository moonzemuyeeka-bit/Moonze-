export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Service {
  id: string;
  /** Canonical name, e.g. "Box Braids". */
  name: string;
  /** Search aliases / hairdo keywords, e.g. ["braids", "protective style"]. */
  aliases: string[];
  category: 'hair' | 'nails' | 'spa' | 'makeup' | 'skincare';
  /** Base in-salon price in the salon's local currency (minor unit ignored). */
  basePrice: number;
  /** Typical duration in minutes, used for availability slotting. */
  durationMinutes: number;
}

export interface Review {
  author: string;
  rating: number; // 1..5
  comment: string;
}

export interface RideHailingPartner {
  /** e.g. "Uber", "Bolt", "Little". */
  name: string;
  /** Discount code the salon negotiated for its customers, if any. */
  promoCode?: string;
  /** Percentage off the ride fare, 0..1. */
  discount: number;
  /** Whether the salon covers a late-night return ride for late appointments. */
  coversLateReturn: boolean;
}

export interface Salon {
  id: string;
  name: string;
  location: GeoPoint;
  address: string;
  city: string;
  currency: string;
  rating: number; // aggregate 1..5
  reviewCount: number;
  reviews: Review[];
  /** Service ids offered here. */
  serviceIds: string[];
  /** Whether the salon offers mobile / come-to-you appointments. */
  offersMobile: boolean;
  /** Extra fraction added on top of base price for mobile service, 0..1. */
  mobileMarkup: number;
  /** Discount fraction for pre-booking ahead of time, 0..1. */
  prebookingDiscount: number;
  /** Discount fraction for verified students, 0..1. */
  studentDiscount: number;
  /** Business open hour (24h) and close hour, local time. */
  openHour: number;
  closeHour: number;
  ridePartners: RideHailingPartner[];
  /** Ride-hailing deep links / embed availability. */
  hasEmbeddedRideHailing: boolean;
}

export interface PriceQuoteInput {
  salon: Salon;
  service: Service;
  mobile?: boolean;
  prebooking?: boolean;
  isStudent?: boolean;
  /** Whether the student has provided valid proof (student ID / .edu email). */
  studentProofVerified?: boolean;
}

export interface PriceLineItem {
  label: string;
  amount: number; // signed; negative for discounts, positive for surcharges
}

export interface PriceQuote {
  currency: string;
  basePrice: number;
  lineItems: PriceLineItem[];
  total: number;
  /** Notes surfaced to the customer, e.g. why a discount was not applied. */
  notes: string[];
}

export interface AppointmentSlot {
  /** ISO date, e.g. "2026-07-20". */
  date: string;
  /** "HH:MM" 24h start time. */
  time: string;
  available: boolean;
}

export interface Appointment {
  id: string;
  salonId: string;
  serviceId: string;
  customerName: string;
  customerPhone: string;
  date: string;
  time: string;
  mobile: boolean;
  quote: PriceQuote;
  createdAt: string;
}
