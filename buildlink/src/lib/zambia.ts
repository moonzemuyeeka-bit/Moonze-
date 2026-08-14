/**
 * Zambian geography reference data.
 *
 * Seeded into the `Province` / `District` tables so locations are relational
 * (filterable, joinable, extensible) rather than free text. Coordinates are
 * district-centre approximations used only for the "nearest supplier" ranking,
 * which the UI labels as an estimate.
 *
 * Adding a district is a data change: append here and re-run `npm run db:seed`,
 * which upserts and never deletes.
 */

export type DistrictSeed = {
  name: string;
  latitude: number;
  longitude: number;
};

export type ProvinceSeed = {
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  districts: DistrictSeed[];
};

export const ZAMBIAN_PROVINCES: ProvinceSeed[] = [
  {
    name: "Lusaka",
    code: "LSK",
    latitude: -15.4167,
    longitude: 28.2833,
    districts: [
      { name: "Lusaka", latitude: -15.4167, longitude: 28.2833 },
      { name: "Chilanga", latitude: -15.55, longitude: 28.2833 },
      { name: "Kafue", latitude: -15.7691, longitude: 28.1814 },
      { name: "Chongwe", latitude: -15.3289, longitude: 28.6819 },
      { name: "Rufunsa", latitude: -15.05, longitude: 29.65 },
      { name: "Luangwa", latitude: -15.62, longitude: 30.41 },
      { name: "Chirundu", latitude: -16.03, longitude: 28.85 },
    ],
  },
  {
    name: "Copperbelt",
    code: "CBT",
    latitude: -12.8024,
    longitude: 28.2132,
    districts: [
      { name: "Kitwe", latitude: -12.8024, longitude: 28.2132 },
      { name: "Ndola", latitude: -12.9587, longitude: 28.6366 },
      { name: "Chingola", latitude: -12.5289, longitude: 27.8492 },
      { name: "Mufulira", latitude: -12.5497, longitude: 28.2409 },
      { name: "Luanshya", latitude: -13.1367, longitude: 28.4166 },
      { name: "Kalulushi", latitude: -12.8395, longitude: 28.0942 },
      { name: "Chililabombwe", latitude: -12.3667, longitude: 27.8333 },
      { name: "Masaiti", latitude: -13.15, longitude: 28.35 },
      { name: "Mpongwe", latitude: -13.5167, longitude: 28.15 },
      { name: "Lufwanyama", latitude: -12.9, longitude: 27.6 },
    ],
  },
  {
    name: "Central",
    code: "CEN",
    latitude: -14.4469,
    longitude: 28.4464,
    districts: [
      { name: "Kabwe", latitude: -14.4469, longitude: 28.4464 },
      { name: "Kapiri Mposhi", latitude: -13.9709, longitude: 28.6698 },
      { name: "Chibombo", latitude: -14.6558, longitude: 28.0703 },
      { name: "Chisamba", latitude: -14.9667, longitude: 28.3667 },
      { name: "Mkushi", latitude: -13.6206, longitude: 29.3925 },
      { name: "Serenje", latitude: -13.2333, longitude: 30.2333 },
      { name: "Mumbwa", latitude: -14.9833, longitude: 27.0667 },
    ],
  },
  {
    name: "Eastern",
    code: "EST",
    latitude: -13.6333,
    longitude: 32.65,
    districts: [
      { name: "Chipata", latitude: -13.6333, longitude: 32.65 },
      { name: "Petauke", latitude: -14.2333, longitude: 31.3167 },
      { name: "Katete", latitude: -14.0833, longitude: 32.05 },
      { name: "Lundazi", latitude: -12.2833, longitude: 33.1833 },
      { name: "Nyimba", latitude: -14.55, longitude: 30.8167 },
      { name: "Chadiza", latitude: -14.0667, longitude: 32.4333 },
    ],
  },
  {
    name: "Southern",
    code: "STH",
    latitude: -16.8,
    longitude: 26.9833,
    districts: [
      { name: "Livingstone", latitude: -17.8419, longitude: 25.8543 },
      { name: "Choma", latitude: -16.8, longitude: 26.9833 },
      { name: "Mazabuka", latitude: -15.8567, longitude: 27.7594 },
      { name: "Monze", latitude: -16.2833, longitude: 27.4833 },
      { name: "Kalomo", latitude: -16.9833, longitude: 26.4833 },
      { name: "Siavonga", latitude: -16.5372, longitude: 28.7089 },
      { name: "Namwala", latitude: -15.75, longitude: 26.4333 },
    ],
  },
  {
    name: "Western",
    code: "WST",
    latitude: -15.2482,
    longitude: 23.1272,
    districts: [
      { name: "Mongu", latitude: -15.2482, longitude: 23.1272 },
      { name: "Kaoma", latitude: -14.8, longitude: 24.8 },
      { name: "Senanga", latitude: -16.1167, longitude: 23.2667 },
      { name: "Kalabo", latitude: -14.9667, longitude: 22.6833 },
      { name: "Sesheke", latitude: -17.4667, longitude: 24.3 },
      { name: "Lukulu", latitude: -14.3667, longitude: 23.2333 },
    ],
  },
  {
    name: "Northern",
    code: "NTH",
    latitude: -10.2129,
    longitude: 31.1808,
    districts: [
      { name: "Kasama", latitude: -10.2129, longitude: 31.1808 },
      { name: "Mbala", latitude: -8.8375, longitude: 31.3667 },
      { name: "Mpulungu", latitude: -8.7667, longitude: 31.1167 },
      { name: "Mporokoso", latitude: -9.3667, longitude: 30.1167 },
      { name: "Luwingu", latitude: -10.2667, longitude: 29.9 },
      { name: "Kaputa", latitude: -8.4667, longitude: 29.6667 },
    ],
  },
  {
    name: "Luapula",
    code: "LPL",
    latitude: -11.1996,
    longitude: 28.894,
    districts: [
      { name: "Mansa", latitude: -11.1996, longitude: 28.894 },
      { name: "Samfya", latitude: -11.3667, longitude: 29.55 },
      { name: "Kawambwa", latitude: -9.7833, longitude: 29.0833 },
      { name: "Nchelenge", latitude: -9.3333, longitude: 28.7333 },
      { name: "Mwense", latitude: -10.3833, longitude: 28.7 },
    ],
  },
  {
    name: "Muchinga",
    code: "MCH",
    latitude: -10.55,
    longitude: 32.0667,
    districts: [
      { name: "Chinsali", latitude: -10.55, longitude: 32.0667 },
      { name: "Mpika", latitude: -11.8333, longitude: 31.45 },
      { name: "Isoka", latitude: -10.1333, longitude: 32.6333 },
      { name: "Nakonde", latitude: -9.3333, longitude: 32.75 },
      { name: "Mafinga", latitude: -10.1, longitude: 33.2 },
    ],
  },
  {
    name: "North-Western",
    code: "NWP",
    latitude: -12.1686,
    longitude: 26.3844,
    districts: [
      { name: "Solwezi", latitude: -12.1686, longitude: 26.3844 },
      { name: "Kalumbila", latitude: -12.3, longitude: 25.3 },
      { name: "Kasempa", latitude: -13.4667, longitude: 25.8333 },
      { name: "Mwinilunga", latitude: -11.7333, longitude: 24.4333 },
      { name: "Zambezi", latitude: -13.55, longitude: 23.1 },
      { name: "Kabompo", latitude: -13.6, longitude: 24.2 },
      { name: "Mufumbwe", latitude: -13.6833, longitude: 24.8167 },
    ],
  },
];

/** Zambian mobile numbers: +260 9X XXX XXXX / 09X XXX XXXX. */
export const ZAMBIAN_PHONE_PATTERN = /^(?:\+?260|0)(?:9[567]|7[567])\d{7}$/;

/**
 * Normalises a Zambian number to E.164 (`+2609XXXXXXXX`) so phone lookups are
 * unambiguous once OTP verification is enabled.
 */
export function normaliseZambianPhone(input: string): string | null {
  const digits = input.replace(/[\s\-()]/g, "");
  if (!ZAMBIAN_PHONE_PATTERN.test(digits)) return null;
  const local = digits.replace(/^(?:\+?260|0)/, "");
  return `+260${local}`;
}

export function formatZambianPhone(e164: string): string {
  const match = /^\+260(\d{2})(\d{3})(\d{4})$/.exec(e164);
  if (!match) return e164;
  return `+260 ${match[1]} ${match[2]} ${match[3]}`;
}
