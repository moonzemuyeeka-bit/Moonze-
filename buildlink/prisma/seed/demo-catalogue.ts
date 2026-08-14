import type { ProductUnit, VerificationStatus } from "@prisma/client";

/**
 * Demonstration marketplace data.
 *
 * Every business and product here is fictional and prefixed `[DEMO]` so nobody
 * can mistake it for a real supplier, and every row is written with `isDemo:
 * true` so production data can exclude it with a single filter.
 *
 * Prices are **indicative Zambian retail levels** used to make the marketplace
 * legible — they are not quotes, and the UI labels them as seed pricing. All
 * amounts are ngwee (1 ZMW = 100 ngwee).
 */

export type DemoProduct = {
  name: string;
  categorySlug: string;
  brand: string | null;
  unit: ProductUnit;
  /** Kwacha; converted to ngwee on insert. */
  price: number;
  description: string;
  stock: number;
  minimumOrderQuantity?: number;
  lowStockThreshold?: number;
};

export type DemoSupplier = {
  slug: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  description: string;
  provinceCode: string;
  districtName: string;
  address: string;
  verificationStatus: VerificationStatus;
  registrationNumber: string | null;
  yearsOperating: number;
  deliveryAvailable: boolean;
  deliveryNotes: string | null;
  minimumOrder: number;
  deliveryBaseFee: number;
  deliveryFreeAbove: number | null;
  ratingAverage: number;
  ratingCount: number;
  completedOrders: number;
  cancelledOrders: number;
  averageResponseMinutes: number;
  isPromoted: boolean;
  categorySlugs: string[];
  products: DemoProduct[];
};

export const DEMO_SUPPLIERS: DemoSupplier[] = [
  {
    slug: "zambezi-cement-and-aggregates",
    businessName: "[DEMO] Zambezi Cement & Aggregates",
    contactName: "Mwansa Bwalya",
    email: "sales@demo-zambezicement.zm",
    phone: "+260977100201",
    description:
      "Bulk cement, sand and quarry stone supplier serving Lusaka and surrounding districts. Own fleet of tippers for same-week delivery on truck loads.",
    provinceCode: "LSK",
    districtName: "Lusaka",
    address: "Plot 214, Mumbwa Road, Lusaka West",
    verificationStatus: "VERIFIED",
    registrationNumber: "120210001234",
    yearsOperating: 11,
    deliveryAvailable: true,
    deliveryNotes: "Tipper delivery within 40 km of Lusaka CBD. Loads over 10 tons quoted per site.",
    minimumOrder: 50_000,
    deliveryBaseFee: 35_000,
    deliveryFreeAbove: 1_500_000,
    ratingAverage: 4.6,
    ratingCount: 87,
    completedOrders: 412,
    cancelledOrders: 9,
    averageResponseMinutes: 42,
    isPromoted: true,
    categorySlugs: ["cement", "sand", "quarry-and-stones"],
    products: [
      {
        name: "Portland Cement 32.5N — 50 kg bag",
        categorySlug: "general-purpose-cement",
        brand: "Mpande",
        unit: "BAG",
        price: 195,
        description:
          "General purpose 32.5N Portland cement in 50 kg bags. Suited to foundations, block laying, plastering and general concrete work. Stored on pallets under cover.",
        stock: 4200,
        minimumOrderQuantity: 10,
        lowStockThreshold: 200,
      },
      {
        name: "High Strength Cement 42.5N — 50 kg bag",
        categorySlug: "high-strength-cement",
        brand: "Lafarge Powermax",
        unit: "BAG",
        price: 232,
        description:
          "42.5N rapid-strength cement for structural concrete, columns, beams and slabs where early formwork stripping matters.",
        stock: 1850,
        minimumOrderQuantity: 10,
        lowStockThreshold: 150,
      },
      {
        name: "Masonry Cement — 50 kg bag",
        categorySlug: "masonry-cement",
        brand: "Mpande",
        unit: "BAG",
        price: 178,
        description:
          "Masonry cement for mortar and rendering. More workable than general purpose cement for block laying and plaster.",
        stock: 960,
        minimumOrderQuantity: 10,
      },
      {
        name: "River Sand — 7 ton tipper load",
        categorySlug: "river-sand",
        brand: null,
        unit: "TRUCK",
        price: 2_250,
        description:
          "Washed river sand delivered by 7 ton tipper. Clean grading suitable for concrete and plaster. Price includes delivery within 25 km of Lusaka.",
        stock: 40,
        lowStockThreshold: 5,
      },
      {
        name: "Plaster Sand — 7 ton tipper load",
        categorySlug: "plaster-sand",
        brand: null,
        unit: "TRUCK",
        price: 2_450,
        description:
          "Fine screened plaster sand for internal and external rendering. Low silt content, screened on site before loading.",
        stock: 26,
      },
      {
        name: "Pit Sand — 7 ton tipper load",
        categorySlug: "pit-sand",
        brand: null,
        unit: "TRUCK",
        price: 1_650,
        description: "Pit sand for backfill, blinding and general bulk fill work.",
        stock: 55,
      },
      {
        name: "Crushed Stone 19 mm — per ton",
        categorySlug: "crushed-stone",
        brand: null,
        unit: "TON",
        price: 345,
        description:
          "19 mm crushed granite aggregate for structural concrete. Quarried and screened locally, sold by weighbridge ticket.",
        stock: 620,
        minimumOrderQuantity: 5,
      },
      {
        name: "Crushed Stone 9.5 mm — per ton",
        categorySlug: "crushed-stone",
        brand: null,
        unit: "TON",
        price: 365,
        description: "9.5 mm aggregate for thin slabs, screeds and precast work.",
        stock: 280,
        minimumOrderQuantity: 5,
      },
      {
        name: "Quarry Dust — 7 ton tipper load",
        categorySlug: "quarry-dust",
        brand: null,
        unit: "TRUCK",
        price: 1_850,
        description:
          "Quarry dust for paving bedding, blinding layers and driveway compaction.",
        stock: 34,
      },
      {
        name: "Hardcore / Rubble — 7 ton tipper load",
        categorySlug: "hardcore",
        brand: null,
        unit: "TRUCK",
        price: 1_950,
        description: "Broken stone hardcore for foundation and floor slab base layers.",
        stock: 22,
      },
    ],
  },
  {
    slug: "kalulushi-block-works",
    businessName: "[DEMO] Kalulushi Block Works",
    contactName: "Grace Chanda",
    email: "orders@demo-kalulushiblocks.zm",
    phone: "+260966100302",
    description:
      "Copperbelt concrete block and paver manufacturer. Vibro-compacted blocks cured for 21 days before dispatch, with lintels made to order.",
    provinceCode: "CBT",
    districtName: "Kalulushi",
    address: "Industrial Area, Off Chibuluma Road, Kalulushi",
    verificationStatus: "VERIFIED",
    registrationNumber: "120180005678",
    yearsOperating: 8,
    deliveryAvailable: true,
    deliveryNotes: "Flatbed delivery across the Copperbelt. Minimum 500 blocks per delivery.",
    minimumOrder: 80_000,
    deliveryBaseFee: 45_000,
    deliveryFreeAbove: 2_000_000,
    ratingAverage: 4.4,
    ratingCount: 63,
    completedOrders: 238,
    cancelledOrders: 11,
    averageResponseMinutes: 95,
    isPromoted: false,
    categorySlugs: ["bricks-and-blocks", "cement"],
    products: [
      {
        name: "Concrete Block 6 inch (150 mm) — solid",
        categorySlug: "concrete-blocks",
        brand: null,
        unit: "PIECE",
        price: 11.5,
        description:
          "150 mm solid vibro-compacted concrete block for load-bearing external walls. 21-day cured, 7 N/mm² nominal strength.",
        stock: 24_000,
        minimumOrderQuantity: 500,
        lowStockThreshold: 2000,
      },
      {
        name: "Concrete Block 4 inch (100 mm) — solid",
        categorySlug: "concrete-blocks",
        brand: null,
        unit: "PIECE",
        price: 8.2,
        description: "100 mm solid block for internal partition walls and boundary infill.",
        stock: 31_000,
        minimumOrderQuantity: 500,
      },
      {
        name: "Concrete Block 8 inch (200 mm) — hollow",
        categorySlug: "concrete-blocks",
        brand: null,
        unit: "PIECE",
        price: 15.8,
        description:
          "200 mm hollow block for boundary walls and retaining structures. Cavities take vertical reinforcement.",
        stock: 9_400,
        minimumOrderQuantity: 300,
      },
      {
        name: "Burnt Clay Brick — standard",
        categorySlug: "burnt-clay-bricks",
        brand: null,
        unit: "PIECE",
        price: 2.1,
        description:
          "Kiln-fired clay brick with consistent size and colour, for face brickwork and boundary walls.",
        stock: 78_000,
        minimumOrderQuantity: 1000,
      },
      {
        name: "Interlocking Soil Block",
        categorySlug: "interlocking-blocks",
        brand: null,
        unit: "PIECE",
        price: 6.4,
        description:
          "Cement-stabilised interlocking block. Reduces mortar use significantly on straight wall runs.",
        stock: 12_500,
        minimumOrderQuantity: 500,
      },
      {
        name: "Concrete Paver 60 mm — grey",
        categorySlug: "pavers-and-kerbs",
        brand: null,
        unit: "PIECE",
        price: 4.8,
        description:
          "60 mm interlocking paver for driveways and walkways. Approximately 39 pavers per square metre.",
        stock: 42_000,
        minimumOrderQuantity: 500,
      },
      {
        name: "Precast Lintel 150 × 100 mm — 1.2 m",
        categorySlug: "lintels",
        brand: null,
        unit: "PIECE",
        price: 165,
        description:
          "Reinforced precast lintel for standard window openings up to 1.05 m clear span.",
        stock: 340,
        minimumOrderQuantity: 4,
      },
      {
        name: "Road Kerb 300 × 150 mm",
        categorySlug: "pavers-and-kerbs",
        brand: null,
        unit: "PIECE",
        price: 78,
        description: "Precast concrete kerb for driveway and pavement edging.",
        stock: 900,
        minimumOrderQuantity: 20,
      },
    ],
  },
  {
    slug: "great-north-roofing-and-steel",
    businessName: "[DEMO] Great North Roofing & Steel",
    contactName: "Peter Sinkala",
    email: "quotes@demo-greatnorthroofing.zm",
    phone: "+260955100403",
    description:
      "Roll-formed roofing sheets cut to your rafter length, plus reinforcement bar, brickforce, purlins and roofing fixings.",
    provinceCode: "LSK",
    districtName: "Lusaka",
    address: "Plot 8, Kafue Road Industrial Park, Lusaka",
    verificationStatus: "VERIFIED",
    registrationNumber: "120150009012",
    yearsOperating: 14,
    deliveryAvailable: true,
    deliveryNotes: "Sheets over 4 m delivered on our flatbed only. Lusaka and Central province.",
    minimumOrder: 100_000,
    deliveryBaseFee: 40_000,
    deliveryFreeAbove: 2_500_000,
    ratingAverage: 4.8,
    ratingCount: 124,
    completedOrders: 587,
    cancelledOrders: 7,
    averageResponseMinutes: 28,
    isPromoted: true,
    categorySlugs: ["roofing", "steel-and-reinforcement"],
    products: [
      {
        name: "IBR Roofing Sheet 0.47 mm — per linear metre",
        categorySlug: "ibr-sheets",
        brand: "Safintra",
        unit: "METRE",
        price: 186,
        description:
          "686 mm cover IBR profile in 0.47 mm galvanised steel, roll-formed to your exact rafter length. Chromadek colour options available on request.",
        stock: 3_600,
        minimumOrderQuantity: 6,
        lowStockThreshold: 300,
      },
      {
        name: "IBR Roofing Sheet 0.58 mm — per linear metre",
        categorySlug: "ibr-sheets",
        brand: "Safintra",
        unit: "METRE",
        price: 241,
        description:
          "Heavier 0.58 mm IBR sheet for wider purlin spacing and exposed sites. 686 mm effective cover.",
        stock: 1_400,
        minimumOrderQuantity: 6,
      },
      {
        name: "Corrugated Sheet 0.47 mm — per linear metre",
        categorySlug: "corrugated-sheets",
        brand: null,
        unit: "METRE",
        price: 172,
        description: "762 mm cover corrugated galvanised sheet, cut to length.",
        stock: 2_100,
        minimumOrderQuantity: 6,
      },
      {
        name: "Ridge Cap 0.47 mm — 1.8 m length",
        categorySlug: "ridges-and-flashings",
        brand: null,
        unit: "PIECE",
        price: 165,
        description: "Plain ridge capping for IBR and corrugated roofs, 1.8 m lengths.",
        stock: 480,
        minimumOrderQuantity: 2,
      },
      {
        name: "Roofing Screw 65 mm with EPDM washer — box of 100",
        categorySlug: "roofing-fixings",
        brand: null,
        unit: "BOX",
        price: 285,
        description:
          "Self-drilling hex-head roofing screws with bonded EPDM washers for a watertight fixing into timber purlins.",
        stock: 320,
      },
      {
        name: "Gutter 125 mm PVC — 4 m length",
        categorySlug: "gutters-and-downpipes",
        brand: "Marley",
        unit: "PIECE",
        price: 310,
        description: "125 mm half-round PVC gutter in 4 m lengths. Brackets sold separately.",
        stock: 260,
      },
      {
        name: "Reinforcement Bar Y12 — 12 m length",
        categorySlug: "reinforcement-bar",
        brand: null,
        unit: "PIECE",
        price: 236,
        description:
          "12 mm high-tensile deformed reinforcement bar, 12 m lengths. Mill certificates available on request.",
        stock: 780,
        minimumOrderQuantity: 5,
        lowStockThreshold: 60,
      },
      {
        name: "Reinforcement Bar Y10 — 12 m length",
        categorySlug: "reinforcement-bar",
        brand: null,
        unit: "PIECE",
        price: 168,
        description: "10 mm high-tensile deformed bar for slabs, columns and ring beams.",
        stock: 1_050,
        minimumOrderQuantity: 5,
      },
      {
        name: "Brickforce 150 mm — 20 m roll",
        categorySlug: "brickforce-and-mesh",
        brand: null,
        unit: "BUNDLE",
        price: 132,
        description:
          "Galvanised brickforce reinforcement for block work bed joints, 20 m rolls, 150 mm width.",
        stock: 640,
      },
      {
        name: "Mesh Wire Ref 193 — 6 × 2.4 m sheet",
        categorySlug: "brickforce-and-mesh",
        brand: null,
        unit: "SHEET",
        price: 895,
        description: "Welded mesh reinforcement sheet for ground-bearing slabs and driveways.",
        stock: 145,
      },
      {
        name: "Lipped Channel Purlin 100 × 50 × 2 mm — 6 m",
        categorySlug: "purlins",
        brand: null,
        unit: "PIECE",
        price: 520,
        description: "Cold-formed galvanised steel purlin for steel roof structures.",
        stock: 210,
        minimumOrderQuantity: 4,
      },
    ],
  },
  {
    slug: "kafue-plumbing-and-water",
    businessName: "[DEMO] Kafue Plumbing & Water Systems",
    contactName: "Josephine Mulenga",
    email: "hello@demo-kafueplumbing.zm",
    phone: "+260976100504",
    description:
      "Plumbing fittings, sanitaryware, geysers, tanks and pumps. Registered plumbers available for installation quotes.",
    provinceCode: "LSK",
    districtName: "Kafue",
    address: "Shop 4, Kafue Town Centre, Kafue",
    verificationStatus: "VERIFIED",
    registrationNumber: "120190003456",
    yearsOperating: 6,
    deliveryAvailable: true,
    deliveryNotes: "Bakkie delivery within Lusaka province. Tanks delivered on flatbed by arrangement.",
    minimumOrder: 25_000,
    deliveryBaseFee: 25_000,
    deliveryFreeAbove: 800_000,
    ratingAverage: 4.3,
    ratingCount: 41,
    completedOrders: 156,
    cancelledOrders: 8,
    averageResponseMinutes: 130,
    isPromoted: false,
    categorySlugs: ["plumbing", "water-systems"],
    products: [
      {
        name: "PVC Pressure Pipe 110 mm Class 6 — 6 m",
        categorySlug: "pipes-and-fittings",
        brand: "Marley",
        unit: "PIECE",
        price: 268,
        description: "110 mm Class 6 PVC pressure pipe in 6 m lengths for main supply runs.",
        stock: 190,
      },
      {
        name: "PPR Pipe 25 mm PN20 — 4 m",
        categorySlug: "pipes-and-fittings",
        brand: null,
        unit: "PIECE",
        price: 96,
        description:
          "25 mm PN20 polypropylene pipe for hot and cold internal plumbing. Heat-fusion jointed.",
        stock: 420,
      },
      {
        name: "Close-Coupled Toilet Suite — white",
        categorySlug: "toilets-and-cisterns",
        brand: "Betta",
        unit: "PIECE",
        price: 1_395,
        description:
          "Close-coupled WC pan, cistern, dual-flush mechanism and soft-close seat. Complete with fixings.",
        stock: 64,
        lowStockThreshold: 8,
      },
      {
        name: "Wall-Hung Basin 500 mm with pedestal",
        categorySlug: "basins-and-sinks",
        brand: "Betta",
        unit: "PIECE",
        price: 745,
        description: "500 mm vitreous china basin with matching pedestal and single tap hole.",
        stock: 48,
      },
      {
        name: "Stainless Kitchen Sink — double bowl, drainer",
        categorySlug: "basins-and-sinks",
        brand: null,
        unit: "PIECE",
        price: 1_180,
        description:
          "Drop-in stainless steel double-bowl sink with drainer board, 1500 × 500 mm.",
        stock: 22,
      },
      {
        name: "Basin Mixer Tap — chrome",
        categorySlug: "taps-and-mixers",
        brand: "Cobra",
        unit: "PIECE",
        price: 465,
        description: "Single-lever chrome basin mixer with ceramic cartridge and flexible tails.",
        stock: 110,
      },
      {
        name: "Electric Geyser 150 litre — horizontal",
        categorySlug: "geysers",
        brand: "Kwikot",
        unit: "PIECE",
        price: 4_650,
        description:
          "150 litre horizontal electric geyser, 4 kW element, 400 kPa. Supplied with pressure control valve.",
        stock: 18,
        lowStockThreshold: 3,
      },
      {
        name: "Water Tank 5000 litre — vertical",
        categorySlug: "water-tanks",
        brand: "Jojo",
        unit: "PIECE",
        price: 4_850,
        description:
          "5000 litre food-grade polyethylene vertical tank, UV stabilised, with inlet and outlet fittings.",
        stock: 26,
      },
      {
        name: "Water Tank 2500 litre — vertical",
        categorySlug: "water-tanks",
        brand: "Jojo",
        unit: "PIECE",
        price: 2_780,
        description: "2500 litre UV-stabilised vertical storage tank for domestic use.",
        stock: 34,
      },
      {
        name: "Steel Tank Stand 3 m — 5000 litre rated",
        categorySlug: "tank-stands",
        brand: null,
        unit: "PIECE",
        price: 3_280,
        description:
          "Welded and painted 3 m steel tank stand rated for a 5000 litre tank. Delivered flat-packed with bolts.",
        stock: 12,
      },
      {
        name: "Submersible Borehole Pump 0.75 kW",
        categorySlug: "pumps",
        brand: "Pedrollo",
        unit: "PIECE",
        price: 7_950,
        description:
          "0.75 kW 4-inch submersible pump with control box, suitable for domestic boreholes to 60 m.",
        stock: 9,
        lowStockThreshold: 2,
      },
      {
        name: "PVC Soil Pipe 110 mm — 6 m",
        categorySlug: "drainage",
        brand: null,
        unit: "PIECE",
        price: 232,
        description: "110 mm PVC soil and waste pipe for foul drainage runs.",
        stock: 140,
      },
    ],
  },
  {
    slug: "ndola-electrical-supplies",
    businessName: "[DEMO] Ndola Electrical Supplies",
    contactName: "Chola Mumba",
    email: "sales@demo-ndolaelectrical.zm",
    phone: "+260967100605",
    description:
      "Cable, distribution boards, switchgear, lighting and solar backup kits. ZESCO-compliant stock with test certificates.",
    provinceCode: "CBT",
    districtName: "Ndola",
    address: "12 Buteko Avenue, Ndola",
    verificationStatus: "VERIFIED",
    registrationNumber: "120170007890",
    yearsOperating: 9,
    deliveryAvailable: true,
    deliveryNotes: "Copperbelt delivery next working day. Lusaka via courier at cost.",
    minimumOrder: 30_000,
    deliveryBaseFee: 20_000,
    deliveryFreeAbove: 700_000,
    ratingAverage: 4.5,
    ratingCount: 52,
    completedOrders: 203,
    cancelledOrders: 6,
    averageResponseMinutes: 60,
    isPromoted: false,
    categorySlugs: ["electrical"],
    products: [
      {
        name: "Twin & Earth Cable 2.5 mm² — 100 m roll",
        categorySlug: "cable-and-wiring",
        brand: "Metal Fabricators of Zambia",
        unit: "BUNDLE",
        price: 985,
        description:
          "2.5 mm² twin and earth PVC cable, 100 m roll, for socket circuits. Copper conductor, SABS marked.",
        stock: 96,
        lowStockThreshold: 12,
      },
      {
        name: "Twin & Earth Cable 1.5 mm² — 100 m roll",
        categorySlug: "cable-and-wiring",
        brand: "Metal Fabricators of Zambia",
        unit: "BUNDLE",
        price: 640,
        description: "1.5 mm² twin and earth cable for lighting circuits, 100 m roll.",
        stock: 120,
      },
      {
        name: "Surface Conduit 20 mm PVC — 4 m",
        categorySlug: "conduit-and-trunking",
        brand: null,
        unit: "PIECE",
        price: 42,
        description: "20 mm rigid PVC conduit, 4 m lengths, for surface and chased wiring.",
        stock: 560,
        minimumOrderQuantity: 10,
      },
      {
        name: "Distribution Board 12-way — flush mount",
        categorySlug: "distribution-boards",
        brand: "CBI",
        unit: "PIECE",
        price: 895,
        description:
          "12-way flush-mounted distribution board with din rail, neutral and earth bars. Breakers sold separately.",
        stock: 38,
      },
      {
        name: "Circuit Breaker 20 A single pole",
        categorySlug: "distribution-boards",
        brand: "CBI",
        unit: "PIECE",
        price: 128,
        description: "20 A single-pole miniature circuit breaker, 6 kA breaking capacity.",
        stock: 240,
      },
      {
        name: "Earth Leakage Unit 40 A / 30 mA",
        categorySlug: "distribution-boards",
        brand: "CBI",
        unit: "PIECE",
        price: 620,
        description: "40 A double-pole earth leakage protection unit with 30 mA sensitivity.",
        stock: 42,
      },
      {
        name: "Double Wall Socket 16 A — white",
        categorySlug: "switches-and-sockets",
        brand: "Crabtree",
        unit: "PIECE",
        price: 165,
        description: "Flush-mounted 16 A double switched socket outlet with 4 × 4 cover plate.",
        stock: 380,
      },
      {
        name: "One-Lever Light Switch — white",
        categorySlug: "switches-and-sockets",
        brand: "Crabtree",
        unit: "PIECE",
        price: 68,
        description: "Single-lever one-way flush light switch, 2 × 4 plate.",
        stock: 460,
      },
      {
        name: "LED Downlight 12 W — warm white",
        categorySlug: "lighting",
        brand: null,
        unit: "PIECE",
        price: 118,
        description: "12 W recessed LED downlight, 3000 K warm white, 90 mm cut-out.",
        stock: 300,
      },
      {
        name: "Solar Backup Kit 3 kVA with 200 Ah battery",
        categorySlug: "solar-and-backup",
        brand: null,
        unit: "PIECE",
        price: 24_500,
        description:
          "3 kVA hybrid inverter, 200 Ah lithium battery and 4 × 450 W panels. Covers lights, sockets and a fridge through load-shedding.",
        stock: 6,
        lowStockThreshold: 2,
      },
    ],
  },
  {
    slug: "lusaka-tile-and-paint-centre",
    businessName: "[DEMO] Lusaka Tile & Paint Centre",
    contactName: "Naomi Phiri",
    email: "shop@demo-lusakatile.zm",
    phone: "+260954100706",
    description:
      "Floor and wall tiles, paint mixed to order, ceilings, cornices and finishing hardware. Free colour matching in store.",
    provinceCode: "LSK",
    districtName: "Lusaka",
    address: "Unit 11, Manda Hill Trade Centre, Lusaka",
    verificationStatus: "VERIFIED",
    registrationNumber: "120200002345",
    yearsOperating: 5,
    deliveryAvailable: true,
    deliveryNotes: "Same-day delivery in Lusaka for orders placed before 11:00.",
    minimumOrder: 20_000,
    deliveryBaseFee: 18_000,
    deliveryFreeAbove: 600_000,
    ratingAverage: 4.7,
    ratingCount: 96,
    completedOrders: 348,
    cancelledOrders: 5,
    averageResponseMinutes: 35,
    isPromoted: true,
    categorySlugs: ["tiles-and-flooring", "paint", "doors-and-windows", "other-construction-materials"],
    products: [
      {
        name: "Porcelain Floor Tile 600 × 600 mm — light grey matt",
        categorySlug: "floor-tiles",
        brand: "Ceramica",
        unit: "BOX",
        price: 198,
        description:
          "Rectified porcelain floor tile in light grey matt. 4 tiles per box covering 1.44 m². Suitable for living areas and covered patios.",
        stock: 420,
        minimumOrderQuantity: 5,
        lowStockThreshold: 40,
      },
      {
        name: "Ceramic Floor Tile 400 × 400 mm — beige",
        categorySlug: "floor-tiles",
        brand: null,
        unit: "BOX",
        price: 132,
        description: "Ceramic floor tile in beige, 6 tiles per box covering 0.96 m².",
        stock: 560,
        minimumOrderQuantity: 5,
      },
      {
        name: "Ceramic Wall Tile 250 × 400 mm — gloss white",
        categorySlug: "wall-tiles",
        brand: null,
        unit: "BOX",
        price: 118,
        description:
          "Gloss white wall tile for bathrooms and kitchens. 10 tiles per box covering 1.0 m².",
        stock: 640,
        minimumOrderQuantity: 5,
      },
      {
        name: "Tile Adhesive — 20 kg bag",
        categorySlug: "adhesive-and-grout",
        brand: "Bostik",
        unit: "BAG",
        price: 168,
        description:
          "Cement-based tile adhesive for floors and walls. One bag covers roughly 4 m² at 4 mm bed.",
        stock: 380,
        minimumOrderQuantity: 2,
      },
      {
        name: "Tile Grout 5 kg — grey",
        categorySlug: "adhesive-and-grout",
        brand: "Bostik",
        unit: "BAG",
        price: 96,
        description: "Grey cementitious grout for joints up to 6 mm.",
        stock: 210,
      },
      {
        name: "PVA Interior Paint 20 litre — brilliant white",
        categorySlug: "interior-paint",
        brand: "Plascon",
        unit: "LITRE",
        price: 782,
        description:
          "20 litre matt PVA for interior walls and ceilings. Covers approximately 160 m² for two coats.",
        stock: 88,
        lowStockThreshold: 10,
      },
      {
        name: "Acrylic Exterior Paint 20 litre — magnolia",
        categorySlug: "exterior-paint",
        brand: "Plascon",
        unit: "LITRE",
        price: 1_180,
        description:
          "Weather-resistant acrylic exterior wall paint with UV protection. 20 litre pail.",
        stock: 54,
      },
      {
        name: "Roof Paint 20 litre — charcoal",
        categorySlug: "roof-paint",
        brand: "Dulux",
        unit: "LITRE",
        price: 1_450,
        description: "Acrylic roof coating for metal and tiled roofs, charcoal grey.",
        stock: 32,
      },
      {
        name: "Universal Undercoat 5 litre",
        categorySlug: "primers-and-undercoats",
        brand: "Plascon",
        unit: "LITRE",
        price: 385,
        description: "Universal undercoat for timber, metal and previously painted surfaces.",
        stock: 76,
      },
      {
        name: "Paint Roller Set 230 mm with tray",
        categorySlug: "painting-tools",
        brand: null,
        unit: "PIECE",
        price: 145,
        description: "230 mm roller, frame, extension pole and tray.",
        stock: 150,
      },
      {
        name: "Steel Door Frame 813 × 2032 mm",
        categorySlug: "door-frames",
        brand: null,
        unit: "PIECE",
        price: 640,
        description: "Pressed steel door frame for a standard 813 mm internal door, primed.",
        stock: 68,
      },
      {
        name: "Hardboard Interior Door 813 × 2032 mm",
        categorySlug: "doors",
        brand: null,
        unit: "PIECE",
        price: 585,
        description: "Hollow-core hardboard interior door, ready for painting.",
        stock: 74,
      },
      {
        name: "Aluminium Sliding Window 1200 × 1200 mm — natural",
        categorySlug: "aluminium-windows",
        brand: null,
        unit: "PIECE",
        price: 2_280,
        description:
          "Natural anodised aluminium sliding window with 4 mm clear glass and fly screen track.",
        stock: 26,
      },
      {
        name: "Suspended Ceiling Board 1200 × 600 mm",
        categorySlug: "ceilings-and-cornices",
        brand: null,
        unit: "SHEET",
        price: 88,
        description: "Gypsum ceiling tile for suspended grid ceilings, 1200 × 600 mm.",
        stock: 460,
        minimumOrderQuantity: 10,
      },
      {
        name: "Cornice 75 mm — 3 m length",
        categorySlug: "ceilings-and-cornices",
        brand: null,
        unit: "PIECE",
        price: 62,
        description: "Plaster cornice moulding, 75 mm profile, 3 m lengths.",
        stock: 340,
        minimumOrderQuantity: 10,
      },
    ],
  },
  {
    slug: "chipata-timber-and-board",
    businessName: "[DEMO] Chipata Timber & Board",
    contactName: "Daniel Zulu",
    email: "timber@demo-chipatatimber.zm",
    phone: "+260977100807",
    description:
      "Eastern Province sawmill supplying roof timber, brandering, shutter ply and treated poles. Kiln-dried stock available on order.",
    provinceCode: "EST",
    districtName: "Chipata",
    address: "Mchini Industrial Area, Chipata",
    verificationStatus: "PENDING",
    registrationNumber: "120220004567",
    yearsOperating: 3,
    deliveryAvailable: false,
    deliveryNotes: null,
    minimumOrder: 40_000,
    deliveryBaseFee: 0,
    deliveryFreeAbove: null,
    ratingAverage: 4.1,
    ratingCount: 14,
    completedOrders: 38,
    cancelledOrders: 4,
    averageResponseMinutes: 240,
    isPromoted: false,
    categorySlugs: ["timber"],
    products: [
      {
        name: "Roof Rafter 50 × 76 mm — 6 m",
        categorySlug: "roof-timber",
        brand: null,
        unit: "PIECE",
        price: 126,
        description:
          "SA pine roof rafter, 50 × 76 mm, 6 m lengths. Graded and treated to H2 against borer.",
        stock: 620,
        minimumOrderQuantity: 10,
        lowStockThreshold: 50,
      },
      {
        name: "Roof Purlin 38 × 50 mm — 6 m",
        categorySlug: "roof-timber",
        brand: null,
        unit: "PIECE",
        price: 78,
        description: "38 × 50 mm timber purlin / brandering for sheet roof fixing, 6 m lengths.",
        stock: 880,
        minimumOrderQuantity: 10,
      },
      {
        name: "Structural Timber 50 × 152 mm — 6 m",
        categorySlug: "structural-timber",
        brand: null,
        unit: "PIECE",
        price: 268,
        description: "50 × 152 mm structural grade timber for beams and wide-span rafters.",
        stock: 210,
        minimumOrderQuantity: 5,
      },
      {
        name: "Shutter Ply 18 mm — 2440 × 1220 mm sheet",
        categorySlug: "shutter-ply",
        brand: null,
        unit: "SHEET",
        price: 462,
        description:
          "18 mm film-faced shutter plywood for concrete formwork. Reusable for several pours.",
        stock: 165,
        minimumOrderQuantity: 4,
      },
      {
        name: "Chipboard 16 mm — 2440 × 1220 mm sheet",
        categorySlug: "shutter-ply",
        brand: null,
        unit: "SHEET",
        price: 298,
        description: "16 mm chipboard sheet for shelving, cupboard carcasses and dry linings.",
        stock: 120,
      },
      {
        name: "Treated Pole 100–125 mm — 3 m",
        categorySlug: "treated-poles",
        brand: null,
        unit: "PIECE",
        price: 168,
        description: "CCA-treated gum pole, 100–125 mm diameter, 3 m, for fencing and shading.",
        stock: 340,
        minimumOrderQuantity: 10,
      },
    ],
  },
  {
    slug: "livingstone-hardware-depot",
    businessName: "[DEMO] Livingstone Hardware Depot",
    contactName: "Brian Mweemba",
    email: "counter@demo-livingstonehardware.zm",
    phone: "+260965100908",
    description:
      "Southern Province hardware counter: nails, fixings, hand tools, wheelbarrows, safety gear and site consumables.",
    provinceCode: "STH",
    districtName: "Livingstone",
    address: "Mosi-oa-Tunya Road, Livingstone",
    verificationStatus: "UNVERIFIED",
    registrationNumber: null,
    yearsOperating: 2,
    deliveryAvailable: false,
    deliveryNotes: null,
    minimumOrder: 0,
    deliveryBaseFee: 0,
    deliveryFreeAbove: null,
    ratingAverage: 3.8,
    ratingCount: 9,
    completedOrders: 21,
    cancelledOrders: 3,
    averageResponseMinutes: 300,
    isPromoted: false,
    categorySlugs: ["hardware", "other-construction-materials"],
    products: [
      {
        name: "Wire Nails 100 mm — 25 kg box",
        categorySlug: "nails-and-fixings",
        brand: null,
        unit: "BOX",
        price: 712,
        description: "100 mm bright wire nails for roof timber and formwork, 25 kg box.",
        stock: 46,
      },
      {
        name: "Wire Nails 75 mm — 25 kg box",
        categorySlug: "nails-and-fixings",
        brand: null,
        unit: "BOX",
        price: 690,
        description: "75 mm bright wire nails, 25 kg box.",
        stock: 52,
      },
      {
        name: "Wheelbarrow 65 litre — heavy duty",
        categorySlug: "site-equipment",
        brand: null,
        unit: "PIECE",
        price: 685,
        description: "65 litre pressed steel wheelbarrow with pneumatic tyre and braced frame.",
        stock: 34,
      },
      {
        name: "Shovel — square mouth with handle",
        categorySlug: "hand-tools",
        brand: null,
        unit: "PIECE",
        price: 168,
        description: "Square-mouth shovel with hardwood handle for concrete and sand.",
        stock: 88,
      },
      {
        name: "Bricklaying Trowel 250 mm",
        categorySlug: "hand-tools",
        brand: null,
        unit: "PIECE",
        price: 132,
        description: "250 mm carbon steel brick trowel with soft grip handle.",
        stock: 64,
      },
      {
        name: "Spirit Level 1200 mm — aluminium",
        categorySlug: "hand-tools",
        brand: null,
        unit: "PIECE",
        price: 285,
        description: "1200 mm aluminium box-section spirit level with three vials.",
        stock: 40,
      },
      {
        name: "Safety Helmet — white, vented",
        categorySlug: "safety-and-workwear",
        brand: null,
        unit: "PIECE",
        price: 96,
        description: "Vented HDPE safety helmet with adjustable harness.",
        stock: 120,
      },
      {
        name: "Damp Proof Course 375 mm — 30 m roll",
        categorySlug: "damp-proofing",
        brand: null,
        unit: "BUNDLE",
        price: 268,
        description: "375 mm wide polyethylene damp proof course, 30 m roll.",
        stock: 58,
      },
      {
        name: "Bitumen Waterproofing 5 litre",
        categorySlug: "waterproofing",
        brand: null,
        unit: "LITRE",
        price: 420,
        description: "Bituminous waterproofing compound for slabs, gutters and parapets.",
        stock: 42,
      },
    ],
  },
];

export type DemoDeliveryProvider = {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  type: "INDEPENDENT_DRIVER" | "LOGISTICS_COMPANY" | "SUPPLIER_FLEET";
  description: string;
  baseFee: number;
  perKilometre: number;
  verificationStatus: VerificationStatus;
  ratingAverage: number;
  ratingCount: number;
  completedDeliveries: number;
  serviceAreas: Array<{ provinceCode: string; districtName: string | null; fee: number }>;
  vehicles: Array<{
    type:
      | "PICKUP"
      | "VAN"
      | "LIGHT_TRUCK"
      | "TIPPER_TRUCK"
      | "FLATBED_TRUCK"
      | "HEAVY_TRUCK"
      | "TRACTOR_TRAILER";
    registration: string;
    description: string;
    capacityKg: number;
    capacityCubicMetres: number;
  }>;
};

export const DEMO_DELIVERY_PROVIDERS: DemoDeliveryProvider[] = [
  {
    businessName: "[DEMO] Lusaka Site Logistics",
    contactName: "Emmanuel Tembo",
    email: "dispatch@demo-lusakasitelogistics.zm",
    phone: "+260977200101",
    type: "LOGISTICS_COMPANY",
    description:
      "Flatbed and tipper haulage for building materials across Lusaka and Central provinces. Two-hour dispatch on confirmed jobs.",
    baseFee: 30_000,
    perKilometre: 1_800,
    verificationStatus: "VERIFIED",
    ratingAverage: 4.5,
    ratingCount: 38,
    completedDeliveries: 214,
    serviceAreas: [
      { provinceCode: "LSK", districtName: null, fee: 30_000 },
      { provinceCode: "CEN", districtName: null, fee: 65_000 },
    ],
    vehicles: [
      {
        type: "FLATBED_TRUCK",
        registration: "DEMO-BAH 1234",
        description: "8 ton flatbed with drop sides, suited to blocks, sheets and timber.",
        capacityKg: 8000,
        capacityCubicMetres: 22,
      },
      {
        type: "TIPPER_TRUCK",
        registration: "DEMO-BAK 5678",
        description: "7 ton tipper for sand, stone and quarry dust.",
        capacityKg: 7000,
        capacityCubicMetres: 5,
      },
    ],
  },
  {
    businessName: "[DEMO] Copperbelt Cargo Movers",
    contactName: "Agnes Kabwe",
    email: "ops@demo-copperbeltcargo.zm",
    phone: "+260966200202",
    type: "INDEPENDENT_DRIVER",
    description:
      "Owner-driver covering Kitwe, Ndola, Chingola and Luanshya with a 3 ton light truck. Careful with sanitaryware and tiles.",
    baseFee: 22_000,
    perKilometre: 1_500,
    verificationStatus: "VERIFIED",
    ratingAverage: 4.2,
    ratingCount: 17,
    completedDeliveries: 74,
    serviceAreas: [{ provinceCode: "CBT", districtName: null, fee: 22_000 }],
    vehicles: [
      {
        type: "LIGHT_TRUCK",
        registration: "DEMO-CBT 9012",
        description: "3 ton curtain-side light truck with tail lift.",
        capacityKg: 3000,
        capacityCubicMetres: 12,
      },
    ],
  },
];
