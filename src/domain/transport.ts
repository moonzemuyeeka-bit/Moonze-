import { RideHailingPartner, Salon } from './types';

export interface TransportOption {
  partner: string;
  discount: number; // 0..1
  promoCode?: string;
  coversLateReturn: boolean;
  /** Deep link the widget/WhatsApp can render for one-tap ride booking. */
  deepLink: string;
}

export interface TransportPlan {
  salonName: string;
  embedded: boolean;
  options: TransportOption[];
  /** True if any partner covers the return trip for late-finishing appointments. */
  lateReturnCovered: boolean;
  summary: string;
}

function deepLinkFor(partner: RideHailingPartner, salon: Salon): string {
  const drop = `${salon.location.lat},${salon.location.lng}`;
  switch (partner.name.toLowerCase()) {
    case 'uber':
      return `https://m.uber.com/ul/?action=setPickup&dropoff[latitude]=${salon.location.lat}&dropoff[longitude]=${salon.location.lng}`;
    case 'bolt':
      return `https://bolt.eu/?destination=${drop}`;
    case 'little':
      return `https://little.bz/ride?destination=${drop}`;
    default:
      return `https://maps.google.com/?daddr=${drop}`;
  }
}

/**
 * Build the transport plan for getting to (or home from) a salon for customers
 * without personal transport, including any embedded ride-hailing partnerships
 * and whether a late-night return ride is covered.
 */
export function planTransport(salon: Salon, appointmentFinishesLate = false): TransportPlan {
  const options: TransportOption[] = salon.ridePartners.map((p) => ({
    partner: p.name,
    discount: p.discount,
    promoCode: p.promoCode,
    coversLateReturn: p.coversLateReturn,
    deepLink: deepLinkFor(p, salon),
  }));

  const lateReturnCovered = salon.ridePartners.some((p) => p.coversLateReturn);

  let summary: string;
  if (options.length === 0) {
    summary = `${salon.name} has no ride-hailing partners yet. Google Maps directions are available.`;
  } else {
    const names = options.map((o) => o.partner).join(', ');
    summary = `${salon.name} partners with ${names}.`;
    if (appointmentFinishesLate) {
      summary += lateReturnCovered
        ? ' Your late-finishing appointment qualifies for a covered return ride home.'
        : ' Note: a covered late return ride is not available at this salon.';
    }
  }

  return {
    salonName: salon.name,
    embedded: salon.hasEmbeddedRideHailing,
    options,
    lateReturnCovered,
    summary,
  };
}
