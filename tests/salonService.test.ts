import {
  distanceKm,
  findSalons,
  matchService,
  recommendSimilar,
  reviewScore,
} from '../src/domain/salonService';
import { getSalon } from '../src/domain/salonService';

describe('salon discovery', () => {
  it('matches free-text hairdo queries to a service', () => {
    expect(matchService('I want box braids')?.id).toBe('svc_box_braids');
    expect(matchService('knotless please')?.id).toBe('svc_knotless_braids');
    expect(matchService('need a manicure')?.id).toBe('svc_gel_manicure');
    expect(matchService('flying to the moon')).toBeUndefined();
  });

  it('finds salons offering a service sorted by rating without location', () => {
    const res = findSalons({ serviceQuery: 'box braids' });
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((r) => r.service.id === 'svc_box_braids')).toBe(true);
    // sorted descending by rating
    for (let i = 1; i < res.length; i++) {
      expect(res[i - 1].salon.rating).toBeGreaterThanOrEqual(res[i].salon.rating);
    }
  });

  it('sorts by proximity when a location is given', () => {
    const cbd = { lat: -1.2921, lng: 36.8219 };
    const res = findSalons({ serviceQuery: 'knotless', near: cbd });
    expect(res[0].distanceKm).toBeDefined();
    for (let i = 1; i < res.length; i++) {
      expect(res[i - 1].distanceKm!).toBeLessThanOrEqual(res[i].distanceKm!);
    }
  });

  it('filters to mobile-only salons', () => {
    const res = findSalons({ serviceQuery: 'silk press', mobileOnly: true });
    expect(res.every((r) => r.salon.offersMobile)).toBe(true);
  });

  it('computes haversine distance roughly correctly', () => {
    const d = distanceKm({ lat: -1.2921, lng: 36.8219 }, { lat: -1.2635, lng: 36.8028 });
    expect(d).toBeGreaterThan(2);
    expect(d).toBeLessThan(6);
  });

  it('recommends similar salons excluding the reference', () => {
    const recs = recommendSimilar('salon_glow', 'knotless braids', 3);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((r) => r.salon.id !== 'salon_glow')).toBe(true);
  });

  it('blends rating and volume in review score', () => {
    const afro = reviewScore(getSalon('salon_afro')!); // 4.9 x 302
    const serenity = reviewScore(getSalon('salon_serenity')!); // 4.3 x 97
    expect(afro).toBeGreaterThan(serenity);
  });
});
