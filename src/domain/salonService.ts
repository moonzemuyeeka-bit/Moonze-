import { SALONS, SERVICES } from '../data/seed';
import { GeoPoint, Salon, Service } from './types';

/** Haversine distance in kilometres. */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 100) / 100;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function getSalon(id: string): Salon | undefined {
  return SALONS.find((s) => s.id === id);
}

export function getService(id: string): Service | undefined {
  return SERVICES.find((s) => s.id === id);
}

/** Resolve a free-text hairdo/service query to a matching Service, if any. */
export function matchService(query: string): Service | undefined {
  const q = query.toLowerCase().trim();
  if (!q) return undefined;
  // Exact / alias containment scoring.
  let best: { service: Service; score: number } | undefined;
  for (const service of SERVICES) {
    const candidates = [service.name.toLowerCase(), ...service.aliases.map((a) => a.toLowerCase())];
    for (const c of candidates) {
      let score = 0;
      if (q === c) score = 100;
      else if (q.includes(c)) score = 60 + c.length;
      else if (c.includes(q) && q.length >= 3) score = 40 + q.length;
      if (score > 0 && (!best || score > best.score)) {
        best = { service, score };
      }
    }
  }
  return best?.service;
}

export interface SalonMatch {
  salon: Salon;
  distanceKm?: number;
  service: Service;
}

export interface FindOptions {
  serviceQuery: string;
  near?: GeoPoint;
  /** Only salons offering mobile service. */
  mobileOnly?: boolean;
  limit?: number;
}

/**
 * Find salons offering a given hairdo/service, optionally sorted by proximity
 * to the customer, otherwise by rating.
 */
export function findSalons(opts: FindOptions): SalonMatch[] {
  const service = matchService(opts.serviceQuery);
  if (!service) return [];

  let matches: SalonMatch[] = SALONS.filter((s) => s.serviceIds.includes(service.id))
    .filter((s) => (opts.mobileOnly ? s.offersMobile : true))
    .map((salon) => ({
      salon,
      service,
      distanceKm: opts.near ? distanceKm(opts.near, salon.location) : undefined,
    }));

  if (opts.near) {
    matches.sort((a, b) => (a.distanceKm! - b.distanceKm!) || b.salon.rating - a.salon.rating);
  } else {
    matches.sort((a, b) => b.salon.rating - a.salon.rating || b.salon.reviewCount - a.salon.reviewCount);
  }

  return opts.limit ? matches.slice(0, opts.limit) : matches;
}

/**
 * Recommend alternative salons that do a similarly good job (by review quality)
 * for the same service as a reference salon. Uses a weighted score of rating
 * and review volume, and never recommends the reference salon itself.
 */
export function recommendSimilar(referenceSalonId: string, serviceQuery: string, limit = 3): SalonMatch[] {
  const reference = getSalon(referenceSalonId);
  const service = matchService(serviceQuery);
  if (!reference || !service) return [];

  return SALONS.filter((s) => s.id !== reference.id && s.serviceIds.includes(service.id))
    .map((salon) => ({
      salon,
      service,
      distanceKm: distanceKm(reference.location, salon.location),
    }))
    .sort((a, b) => reviewScore(b.salon) - reviewScore(a.salon))
    .slice(0, limit);
}

/** Bayesian-ish score blending rating with review volume so a 4.9 (5 reviews)
 * doesn't automatically beat a 4.8 (300 reviews). */
export function reviewScore(salon: Salon): number {
  const priorRating = 4.2;
  const priorWeight = 20;
  return (
    (salon.rating * salon.reviewCount + priorRating * priorWeight) /
    (salon.reviewCount + priorWeight)
  );
}
