/**
 * Marketplace taxonomy.
 *
 * The single source of truth for categories: seeded into `ProductCategory`,
 * rendered on the landing page and marketplace navigation, and used by the
 * material estimator to map estimated quantities to real category pages.
 *
 * Adding a category is a data change — append here, re-run the seed. Products
 * reference categories by row, so nothing else needs to know.
 */

export type CategorySeed = {
  slug: string;
  name: string;
  description: string;
  iconName: CategoryIconName;
  /** Common search terms, surfaced as suggestions on the marketplace. */
  examples: string[];
  subcategories: Array<{ slug: string; name: string }>;
};

export type CategoryIconName =
  | "cement"
  | "blocks"
  | "sand"
  | "stone"
  | "steel"
  | "timber"
  | "roofing"
  | "plumbing"
  | "electrical"
  | "flooring"
  | "paint"
  | "doors"
  | "hardware"
  | "water"
  | "other";

export const PRODUCT_CATEGORIES: CategorySeed[] = [
  {
    slug: "cement",
    name: "Cement",
    description: "Portland, masonry and rapid-set cement by the bag or by the truck.",
    iconName: "cement",
    examples: ["cement", "32.5N cement", "42.5N cement", "masonry cement"],
    subcategories: [
      { slug: "general-purpose-cement", name: "General purpose (32.5N)" },
      { slug: "high-strength-cement", name: "High strength (42.5N)" },
      { slug: "masonry-cement", name: "Masonry cement" },
      { slug: "rapid-hardening-cement", name: "Rapid hardening" },
    ],
  },
  {
    slug: "bricks-and-blocks",
    name: "Bricks & Blocks",
    description: "Concrete blocks, burnt bricks, pavers and lintels from local manufacturers.",
    iconName: "blocks",
    examples: ["blocks", "6 inch blocks", "burnt bricks", "pavers"],
    subcategories: [
      { slug: "concrete-blocks", name: "Concrete blocks" },
      { slug: "burnt-clay-bricks", name: "Burnt clay bricks" },
      { slug: "interlocking-blocks", name: "Interlocking blocks" },
      { slug: "pavers-and-kerbs", name: "Pavers & kerbs" },
      { slug: "lintels", name: "Lintels" },
    ],
  },
  {
    slug: "sand",
    name: "Sand",
    description: "River sand, pit sand and plaster sand delivered by the truck load.",
    iconName: "sand",
    examples: ["building sand", "river sand", "plaster sand", "pit sand"],
    subcategories: [
      { slug: "river-sand", name: "River sand" },
      { slug: "pit-sand", name: "Pit sand" },
      { slug: "plaster-sand", name: "Plaster sand" },
      { slug: "washed-sand", name: "Washed sand" },
    ],
  },
  {
    slug: "quarry-and-stones",
    name: "Quarry & Stones",
    description: "Crushed stone, quarry dust, hardcore and dimension stone.",
    iconName: "stone",
    examples: ["quarry", "stone", "19mm stone", "hardcore", "quarry dust"],
    subcategories: [
      { slug: "crushed-stone", name: "Crushed stone" },
      { slug: "quarry-dust", name: "Quarry dust" },
      { slug: "hardcore", name: "Hardcore / rubble" },
      { slug: "dimension-stone", name: "Dimension stone" },
    ],
  },
  {
    slug: "steel-and-reinforcement",
    name: "Steel & Reinforcement",
    description: "Reinforcement bar, brickforce, mesh, purlins and structural sections.",
    iconName: "steel",
    examples: ["steel", "y12 bar", "brickforce", "mesh wire", "purlins"],
    subcategories: [
      { slug: "reinforcement-bar", name: "Reinforcement bar" },
      { slug: "brickforce-and-mesh", name: "Brickforce & mesh" },
      { slug: "binding-wire", name: "Binding wire" },
      { slug: "structural-steel", name: "Structural sections" },
      { slug: "purlins", name: "Purlins" },
    ],
  },
  {
    slug: "timber",
    name: "Timber",
    description: "Roof trusses, rafters, brandering, shutter ply and boards.",
    iconName: "timber",
    examples: ["timber", "roof timber", "shutter ply", "brandering"],
    subcategories: [
      { slug: "structural-timber", name: "Structural timber" },
      { slug: "roof-timber", name: "Roof timber" },
      { slug: "shutter-ply", name: "Shutter ply & boards" },
      { slug: "treated-poles", name: "Treated poles" },
    ],
  },
  {
    slug: "roofing",
    name: "Roofing",
    description: "IBR and corrugated sheets, tiles, ridges, gutters and fixings.",
    iconName: "roofing",
    examples: ["roofing sheets", "IBR", "roof tiles", "gutters"],
    subcategories: [
      { slug: "ibr-sheets", name: "IBR sheets" },
      { slug: "corrugated-sheets", name: "Corrugated sheets" },
      { slug: "roof-tiles", name: "Roof tiles" },
      { slug: "ridges-and-flashings", name: "Ridges & flashings" },
      { slug: "gutters-and-downpipes", name: "Gutters & downpipes" },
      { slug: "roofing-fixings", name: "Roofing screws & fixings" },
    ],
  },
  {
    slug: "plumbing",
    name: "Plumbing",
    description: "Pipes, fittings, toilets, basins, taps, geysers and drainage.",
    iconName: "plumbing",
    examples: ["toilet", "pvc pipe", "geyser", "taps", "basin"],
    subcategories: [
      { slug: "pipes-and-fittings", name: "Pipes & fittings" },
      { slug: "toilets-and-cisterns", name: "Toilets & cisterns" },
      { slug: "basins-and-sinks", name: "Basins & sinks" },
      { slug: "taps-and-mixers", name: "Taps & mixers" },
      { slug: "geysers", name: "Geysers" },
      { slug: "drainage", name: "Drainage" },
    ],
  },
  {
    slug: "electrical",
    name: "Electrical",
    description: "Cable, conduit, distribution boards, switches, sockets and lighting.",
    iconName: "electrical",
    examples: ["electrical cable", "distribution board", "sockets", "lighting"],
    subcategories: [
      { slug: "cable-and-wiring", name: "Cable & wiring" },
      { slug: "conduit-and-trunking", name: "Conduit & trunking" },
      { slug: "distribution-boards", name: "Distribution boards" },
      { slug: "switches-and-sockets", name: "Switches & sockets" },
      { slug: "lighting", name: "Lighting" },
      { slug: "solar-and-backup", name: "Solar & backup" },
    ],
  },
  {
    slug: "tiles-and-flooring",
    name: "Tiles & Flooring",
    description: "Floor and wall tiles, adhesive, grout, skirting and finishes.",
    iconName: "flooring",
    examples: ["floor tiles", "wall tiles", "tile adhesive", "grout"],
    subcategories: [
      { slug: "floor-tiles", name: "Floor tiles" },
      { slug: "wall-tiles", name: "Wall tiles" },
      { slug: "adhesive-and-grout", name: "Adhesive & grout" },
      { slug: "skirting", name: "Skirting" },
      { slug: "screed-and-floor-finishes", name: "Screed & floor finishes" },
    ],
  },
  {
    slug: "paint",
    name: "Paint",
    description: "Interior and exterior paint, undercoats, sealers, rollers and brushes.",
    iconName: "paint",
    examples: ["paint", "pva", "roof paint", "undercoat", "primer"],
    subcategories: [
      { slug: "interior-paint", name: "Interior paint" },
      { slug: "exterior-paint", name: "Exterior paint" },
      { slug: "roof-paint", name: "Roof paint" },
      { slug: "primers-and-undercoats", name: "Primers & undercoats" },
      { slug: "painting-tools", name: "Brushes, rollers & tools" },
    ],
  },
  {
    slug: "doors-and-windows",
    name: "Doors & Windows",
    description: "Door frames, doors, steel and aluminium windows, glass and ironmongery.",
    iconName: "doors",
    examples: ["door frame", "aluminium window", "steel window", "door handles"],
    subcategories: [
      { slug: "doors", name: "Doors" },
      { slug: "door-frames", name: "Door frames" },
      { slug: "steel-windows", name: "Steel windows" },
      { slug: "aluminium-windows", name: "Aluminium windows" },
      { slug: "glass", name: "Glass" },
      { slug: "ironmongery", name: "Locks & ironmongery" },
    ],
  },
  {
    slug: "hardware",
    name: "Hardware",
    description: "Nails, screws, wheelbarrows, hand tools, ladders and site consumables.",
    iconName: "hardware",
    examples: ["nails", "wheelbarrow", "shovel", "hand tools"],
    subcategories: [
      { slug: "nails-and-fixings", name: "Nails & fixings" },
      { slug: "hand-tools", name: "Hand tools" },
      { slug: "site-equipment", name: "Site equipment" },
      { slug: "safety-and-workwear", name: "Safety & workwear" },
      { slug: "adhesives-and-sealants", name: "Adhesives & sealants" },
    ],
  },
  {
    slug: "water-systems",
    name: "Water Systems",
    description: "Tanks, tank stands, pumps, boreholes fittings and filtration.",
    iconName: "water",
    examples: ["water tank", "tank stand", "water pump", "borehole"],
    subcategories: [
      { slug: "water-tanks", name: "Water tanks" },
      { slug: "tank-stands", name: "Tank stands" },
      { slug: "pumps", name: "Pumps" },
      { slug: "borehole-fittings", name: "Borehole fittings" },
      { slug: "filtration", name: "Filtration & treatment" },
    ],
  },
  {
    slug: "other-construction-materials",
    name: "Other Construction Materials",
    description: "Damp proofing, ceilings, cornices, waterproofing and everything else.",
    iconName: "other",
    examples: ["ceiling boards", "damp proof course", "waterproofing", "cornice"],
    subcategories: [
      { slug: "ceilings-and-cornices", name: "Ceilings & cornices" },
      { slug: "damp-proofing", name: "Damp proofing" },
      { slug: "waterproofing", name: "Waterproofing" },
      { slug: "insulation", name: "Insulation" },
      { slug: "miscellaneous", name: "Miscellaneous" },
    ],
  },
];

export const CATEGORY_SLUGS = PRODUCT_CATEGORIES.map((category) => category.slug);

export function findCategoryBySlug(slug: string): CategorySeed | undefined {
  return PRODUCT_CATEGORIES.find((category) => category.slug === slug);
}

/** Search suggestions shown under the marketplace search box. */
export const POPULAR_SEARCHES = [
  "Cement",
  "Blocks",
  "Building sand",
  "Quarry stone",
  "Roofing sheets",
  "Steel bar",
  "Toilet",
  "Floor tiles",
  "Paint",
  "Water tank",
] as const;
