import { Salon, Service } from '../domain/types';

/**
 * Catalog of services Flawless understands. `aliases` power fuzzy "find me a
 * salon that does <hairdo>" search.
 */
export const SERVICES: Service[] = [
  {
    id: 'svc_box_braids',
    name: 'Box Braids',
    aliases: ['braids', 'box braids', 'protective style', 'plaiting'],
    category: 'hair',
    basePrice: 3500,
    durationMinutes: 180,
  },
  {
    id: 'svc_knotless_braids',
    name: 'Knotless Braids',
    aliases: ['knotless', 'knotless braids', 'braids'],
    category: 'hair',
    basePrice: 4500,
    durationMinutes: 210,
  },
  {
    id: 'svc_silk_press',
    name: 'Silk Press',
    aliases: ['silk press', 'straightening', 'blow dry', 'blowout'],
    category: 'hair',
    basePrice: 2500,
    durationMinutes: 90,
  },
  {
    id: 'svc_locs_retwist',
    name: 'Locs Retwist',
    aliases: ['locs', 'dreadlocks', 'retwist', 'dreads'],
    category: 'hair',
    basePrice: 3000,
    durationMinutes: 120,
  },
  {
    id: 'svc_gel_manicure',
    name: 'Gel Manicure',
    aliases: ['manicure', 'nails', 'gel nails', 'gel manicure'],
    category: 'nails',
    basePrice: 1500,
    durationMinutes: 60,
  },
  {
    id: 'svc_full_spa',
    name: 'Full Body Spa',
    aliases: ['spa', 'massage', 'full body spa', 'relaxation'],
    category: 'spa',
    basePrice: 6000,
    durationMinutes: 120,
  },
  {
    id: 'svc_bridal_makeup',
    name: 'Bridal Makeup',
    aliases: ['makeup', 'bridal', 'glam', 'bridal makeup'],
    category: 'makeup',
    basePrice: 8000,
    durationMinutes: 90,
  },
];

export const SALONS: Salon[] = [
  {
    id: 'salon_glow',
    name: 'Glow & Grace Studio',
    location: { lat: -1.2921, lng: 36.8219 }, // Nairobi CBD
    address: 'Kimathi Street, CBD',
    city: 'Nairobi',
    currency: 'KES',
    rating: 4.8,
    reviewCount: 214,
    reviews: [
      { author: 'Aisha', rating: 5, comment: 'Best knotless braids in town, gentle on edges.' },
      { author: 'Wanjiru', rating: 5, comment: 'Clean, punctual and the silk press lasted weeks.' },
      { author: 'Fatima', rating: 4, comment: 'Great work, slightly pricey but worth it.' },
    ],
    serviceIds: ['svc_box_braids', 'svc_knotless_braids', 'svc_silk_press', 'svc_gel_manicure'],
    offersMobile: true,
    mobileMarkup: 0.25,
    prebookingDiscount: 0.1,
    studentDiscount: 0.15,
    openHour: 8,
    closeHour: 20,
    ridePartners: [
      { name: 'Uber', discount: 0.15, promoCode: 'GLOWRIDE', coversLateReturn: true },
      { name: 'Bolt', discount: 0.1, coversLateReturn: false },
    ],
    hasEmbeddedRideHailing: true,
  },
  {
    id: 'salon_pearl',
    name: 'Pearl Beauty Lounge',
    location: { lat: -1.2635, lng: 36.8028 }, // Westlands
    address: 'Woodvale Grove, Westlands',
    city: 'Nairobi',
    currency: 'KES',
    rating: 4.6,
    reviewCount: 168,
    reviews: [
      { author: 'Zainab', rating: 5, comment: 'Loved the bridal makeup, flawless finish.' },
      { author: 'Cynthia', rating: 4, comment: 'Relaxing spa, good ambience.' },
    ],
    serviceIds: ['svc_knotless_braids', 'svc_silk_press', 'svc_full_spa', 'svc_bridal_makeup', 'svc_gel_manicure'],
    offersMobile: true,
    mobileMarkup: 0.3,
    prebookingDiscount: 0.08,
    studentDiscount: 0.1,
    openHour: 9,
    closeHour: 21,
    ridePartners: [
      { name: 'Bolt', discount: 0.12, promoCode: 'PEARL12', coversLateReturn: true },
      { name: 'Little', discount: 0.1, coversLateReturn: true },
    ],
    hasEmbeddedRideHailing: true,
  },
  {
    id: 'salon_afro',
    name: 'Afro Crown Braiders',
    location: { lat: -1.3031, lng: 36.7073 }, // Karen
    address: 'Karen Road, Karen',
    city: 'Nairobi',
    currency: 'KES',
    rating: 4.9,
    reviewCount: 302,
    reviews: [
      { author: 'Neema', rating: 5, comment: 'Box braids specialists, super neat parting.' },
      { author: 'Halima', rating: 5, comment: 'Locs retwist done right, will return.' },
      { author: 'Brenda', rating: 5, comment: 'Amazing knotless, and they came to my house!' },
    ],
    serviceIds: ['svc_box_braids', 'svc_knotless_braids', 'svc_locs_retwist'],
    offersMobile: true,
    mobileMarkup: 0.2,
    prebookingDiscount: 0.12,
    studentDiscount: 0.2,
    openHour: 8,
    closeHour: 19,
    ridePartners: [
      { name: 'Uber', discount: 0.1, coversLateReturn: true },
    ],
    hasEmbeddedRideHailing: false,
  },
  {
    id: 'salon_serenity',
    name: 'Serenity Spa & Nails',
    location: { lat: -1.2196, lng: 36.8869 }, // Ruaraka
    address: 'Thika Road, Ruaraka',
    city: 'Nairobi',
    currency: 'KES',
    rating: 4.3,
    reviewCount: 97,
    reviews: [
      { author: 'Joy', rating: 4, comment: 'Nice gel manicure, lasts long.' },
      { author: 'Mercy', rating: 4, comment: 'Good massage after a long week.' },
    ],
    serviceIds: ['svc_gel_manicure', 'svc_full_spa', 'svc_silk_press'],
    offersMobile: false,
    mobileMarkup: 0,
    prebookingDiscount: 0.05,
    studentDiscount: 0.1,
    openHour: 9,
    closeHour: 20,
    ridePartners: [
      { name: 'Little', discount: 0.08, coversLateReturn: false },
    ],
    hasEmbeddedRideHailing: false,
  },
];
