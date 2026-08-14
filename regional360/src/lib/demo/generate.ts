import type {
  Account,
  AccountProduct,
  Campaign,
  Contact,
  CustomerIssue,
  CycleStageName,
  DemoDataset,
  MarketSignal,
  Opportunity,
  Product,
  Salesperson,
  Stage,
  Territory,
} from "@/lib/types";
import { OPEN_STAGES } from "@/lib/types";

// Fixed reference "today" so the demo dataset is fully deterministic across
// server restarts (stable snapshots). Roughly matches the current date.
const NOW = new Date("2026-08-14T00:00:00Z");

// -- Seeded RNG (mulberry32) -------------------------------------------------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KANBAN: Stage[] = [
  "Prospect",
  "Qualified",
  "Discovery",
  "Proposal",
  "Negotiation",
  "Closed Won",
];

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 86400000).toISOString();
}
function daysAhead(n: number): string {
  return new Date(NOW.getTime() + n * 86400000).toISOString();
}

const FIRST_NAMES = [
  "David",
  "Sarah",
  "Marcus",
  "Elena",
  "James",
  "Priya",
  "Thomas",
  "Grace",
  "Daniel",
  "Aisha",
];
const LAST_NAMES = [
  "Chen",
  "Whitfield",
  "Okafor",
  "Rossi",
  "Sullivan",
  "Nair",
  "Berg",
  "Adeyemi",
  "Kowalski",
  "Rahman",
];

const INDUSTRIES = [
  "Financial Services",
  "Healthcare",
  "Manufacturing",
  "Retail",
  "Technology",
  "Energy",
  "Public Sector",
];

const ACCOUNT_PREFIXES = [
  "Meridian",
  "Northwind",
  "Vertex",
  "Apex",
  "Solstice",
  "Cardinal",
  "Ironclad",
  "Brightline",
  "Quantum",
  "Summit",
  "Beacon",
  "Anchor",
  "Cobalt",
  "Granite",
  "Harbor",
  "Lattice",
  "Monarch",
  "Nimbus",
  "Orchard",
  "Pinnacle",
  "Riverstone",
  "Sterling",
  "Tempest",
  "Union",
  "Valor",
  "Westgate",
  "Zenith",
  "Aurora",
  "Baseline",
  "Cascade",
];
const ACCOUNT_SUFFIXES = [
  "Group",
  "Holdings",
  "Industries",
  "Partners",
  "Systems",
  "Corp",
  "Global",
  "Labs",
  "Health",
  "Capital",
  "Logistics",
  "Retail",
  "Energy",
];

const LOST_REASONS = [
  "Price",
  "Competitor",
  "No decision",
  "Budget frozen",
  "Missing feature",
  "Timing",
];

const NEXT_ACTIONS = [
  "Schedule discovery call",
  "Send revised proposal",
  "Confirm budget with sponsor",
  "Book executive review",
  "Follow up on pricing",
  "Complete security review",
  "Align on implementation timeline",
];

export function generateDataset(seed = 42): DemoDataset {
  const rand = mulberry32(seed);
  const randInt = (min: number, max: number) =>
    Math.floor(rand() * (max - min + 1)) + min;
  const randFloat = (min: number, max: number) => rand() * (max - min) + min;
  const chance = (p: number) => rand() < p;
  const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

  const region = {
    id: "region-1",
    name: "North America — Enterprise",
    currency: "USD",
  };

  const territoryNames = [
    "Northern",
    "Southern",
    "Eastern",
    "Western",
    "Central",
  ];
  const territories: Territory[] = territoryNames.map((name) => ({
    id: `terr-${name.toLowerCase()}`,
    name,
    regionId: region.id,
  }));
  const northernId = "terr-northern";

  const products: Product[] = [
    { id: "prod-a", name: "Core Platform", category: "Platform", listPrice: 90000 },
    { id: "prod-b", name: "Analytics Suite", category: "Analytics", listPrice: 55000 },
    { id: "prod-c", name: "Compliance Module", category: "Compliance", listPrice: 40000 },
    { id: "prod-d", name: "Advisory Services", category: "Services", listPrice: 65000 },
    { id: "prod-e", name: "Premium Support", category: "Support", listPrice: 30000 },
  ];

  // -- Salespeople: 2 per territory. Index 0 = David Chen (deliberate
  //    underperformer to support the diagnostic narratives). --------------
  const salespeople: Salesperson[] = [];
  for (let i = 0; i < 10; i++) {
    const territory = territories[Math.floor(i / 2)];
    const name = `${FIRST_NAMES[i]} ${LAST_NAMES[i]}`;
    // performance skill 0..1 — David (0) is weak, a couple are strong.
    let skill: number;
    if (i === 0) skill = 0.28; // David Chen
    else if (i === 3) skill = 0.92; // Elena Rossi — top performer
    else if (i === 5) skill = 0.86;
    else skill = randFloat(0.5, 0.8);
    salespeople.push({
      id: `sp-${i + 1}`,
      name,
      email: `${FIRST_NAMES[i].toLowerCase()}.${LAST_NAMES[i].toLowerCase()}@regional360.example`,
      territoryId: territory.id,
      tenureMonths: i === 0 ? 9 : randInt(14, 84),
      activityScore: i === 0 ? 74 : Math.round(randFloat(55, 96)),
      // stash skill via activity? no — keep separate lookup below
    });
    (salespeople[i] as Salesperson & { skill: number }).skill = skill;
  }
  const skillOf = (sp: Salesperson) =>
    (sp as Salesperson & { skill: number }).skill;

  // -- Accounts ------------------------------------------------------------
  const accounts: Account[] = [];
  const usedNames = new Set<string>();
  const accountCount = 56;

  for (let i = 0; i < accountCount; i++) {
    const owner = salespeople[i % salespeople.length];
    const territoryId = owner.territoryId;
    let name = "";
    // guarantee a distinctive at-risk flagship account: "ABC Manufacturing"
    if (i === 0) {
      name = "ABC Manufacturing";
    } else {
      do {
        name = `${pick(ACCOUNT_PREFIXES)} ${pick(ACCOUNT_SUFFIXES)}`;
      } while (usedNames.has(name));
    }
    usedNames.add(name);
    const industry = i === 0 ? "Manufacturing" : pick(INDUSTRIES);

    const annualRevenue = Math.round(randFloat(80, 620)) * 1000;
    const penetration = i === 0 ? 0.525 : randFloat(0.35, 0.9);
    const potentialRevenue = Math.round(annualRevenue / penetration);

    // Owned products (subset of catalogue)
    const ownedProducts: AccountProduct[] = [];
    const nProducts = i === 0 ? 2 : randInt(1, 4);
    const shuffled = [...products].sort(() => rand() - 0.5);
    for (let p = 0; p < nProducts; p++) {
      const av = Math.round(annualRevenue / nProducts);
      ownedProducts.push({ productId: shuffled[p].id, annualValue: av });
    }

    const isAbc = i === 0;
    const revenueTrendPct = isAbc
      ? -18
      : Math.round(randFloat(-14, 26));
    const engagementTrendPct = isAbc
      ? -32
      : Math.round(randFloat(-25, 30));

    const renewalDays = isAbc ? 45 : randInt(20, 340);
    const lastContactDays = isAbc ? 41 : randInt(1, 60);

    const contacts: Contact[] = [];
    const nContacts = randInt(1, 3);
    const titles = ["VP Operations", "CFO", "Head of Procurement", "COO", "Director of IT"];
    for (let c = 0; c < nContacts; c++) {
      contacts.push({
        id: `contact-${i}-${c}`,
        accountId: `acc-${i + 1}`,
        name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        title: pick(titles),
        email: `contact${c}@${name.toLowerCase().replace(/[^a-z]/g, "")}.example`,
      });
    }

    let relationshipStatus: Account["relationshipStatus"];
    if (isAbc) relationshipStatus = "Declining";
    else if (revenueTrendPct > 12) relationshipStatus = "Growing";
    else if (revenueTrendPct < -6) relationshipStatus = "Declining";
    else if (lastContactDays < 20) relationshipStatus = "Stable";
    else relationshipStatus = "New";

    accounts.push({
      id: `acc-${i + 1}`,
      name,
      industry,
      territoryId,
      ownerId: owner.id,
      annualRevenue,
      potentialRevenue,
      revenueTrendPct,
      engagementTrendPct,
      products: ownedProducts,
      lastContact: daysAgo(lastContactDays),
      nextContact: chance(0.7) ? daysAhead(randInt(2, 30)) : undefined,
      renewalDate: daysAhead(renewalDays),
      relationshipStatus,
      contacts,
    });
  }

  // -- Customer issues -----------------------------------------------------
  const issues: CustomerIssue[] = [];
  let issueId = 1;
  const issueTitles = [
    "Service outage not resolved within SLA",
    "Billing discrepancy under dispute",
    "Onboarding delay for new module",
    "Integration failing intermittently",
    "Support ticket escalation unresolved",
    "Reporting inaccuracy reported",
  ];
  for (const acc of accounts) {
    let n: number;
    if (acc.id === "acc-1") n = 4; // ABC Manufacturing — 4 open complaints
    else n = chance(0.4) ? randInt(1, 3) : 0;
    for (let k = 0; k < n; k++) {
      const resolved = acc.id === "acc-1" ? false : chance(0.5);
      issues.push({
        id: `issue-${issueId++}`,
        accountId: acc.id,
        title: pick(issueTitles),
        severity: pick(["Low", "Medium", "High"]),
        status: resolved ? "resolved" : "open",
        openedAt: daysAgo(randInt(5, 90)),
        resolvedAt: resolved ? daysAgo(randInt(1, 4)) : undefined,
      });
    }
  }

  // -- Opportunities -------------------------------------------------------
  const opportunities: Opportunity[] = [];
  let oppId = 1;

  const genCycle = (cohort: "current" | "previous"): Record<CycleStageName, number> => {
    // Approval time inflated in the current cohort to create a clear
    // process bottleneck narrative (approval +~75%).
    const approvalBase = cohort === "current" ? randFloat(11, 17) : randFloat(6, 9);
    return {
      Qualification: Math.round(randFloat(3, 7)),
      Discovery: Math.round(randFloat(5, 11)),
      Proposal: Math.round(randFloat(4, 9)),
      Approval: Math.round(approvalBase),
      Negotiation: Math.round(randFloat(4, 10)),
      Closing: Math.round(randFloat(2, 6)),
    };
  };

  for (const acc of accounts) {
    const owner = salespeople.find((s) => s.id === acc.ownerId)!;
    const skill = skillOf(owner);
    const isNorthern = owner.territoryId === northernId;
    const nOpps = randInt(1, 4);

    for (let o = 0; o < nOpps; o++) {
      const cohort: "current" | "previous" = chance(0.55) ? "current" : "previous";
      const createdDaysAgo =
        cohort === "current" ? randInt(5, 90) : randInt(95, 200);
      const product = pick(products);
      const value = Math.round(randFloat(25, 260)) * 1000;

      // Determine outcome/stage. Skill drives progression; current cohort in
      // Northern is biased to stall earlier (lower conversion narrative).
      const progressRoll = rand();
      const winThreshold = 0.25 + skill * 0.35; // higher skill wins more
      const stallPenalty = isNorthern && cohort === "current" ? 0.12 : 0;

      let stage: Stage;
      let closedAt: string | undefined;
      let lostReason: string | undefined;
      let cycle: Record<CycleStageName, number> | undefined;
      let maxStageIndex: number;

      if (progressRoll < winThreshold - stallPenalty) {
        stage = "Closed Won";
        closedAt =
          cohort === "current" ? daysAgo(randInt(1, 60)) : daysAgo(randInt(95, 175));
        cycle = genCycle(cohort);
        maxStageIndex = KANBAN.indexOf("Closed Won");
      } else if (progressRoll > 0.82 + stallPenalty) {
        stage = "Closed Lost";
        closedAt = daysAgo(randInt(1, 120));
        lostReason = pick(LOST_REASONS);
        // lost somewhere between qualified and negotiation
        maxStageIndex = randInt(1, 4);
      } else {
        // open — bias current-cohort Northern deals to earlier stages
        const openStages = OPEN_STAGES;
        let idx: number;
        if (isNorthern && cohort === "current") idx = randInt(0, 2);
        else idx = Math.min(openStages.length - 1, Math.floor(skill * openStages.length + randFloat(-1, 1)));
        idx = Math.max(0, Math.min(openStages.length - 1, idx));
        stage = openStages[idx];
        maxStageIndex = KANBAN.indexOf(stage);
      }

      const probMap: Record<string, number> = {
        Prospect: 10,
        Qualified: 25,
        Discovery: 40,
        Proposal: 60,
        Negotiation: 80,
        "Closed Won": 100,
        "Closed Lost": 0,
      };
      const daysInStage = randInt(2, 45);
      const ageDays =
        typeof createdDaysAgo === "number" ? createdDaysAgo : 30;

      const riskStatus: Opportunity["riskStatus"] =
        stage === "Closed Won" || stage === "Closed Lost"
          ? "On Track"
          : daysInStage > 30
            ? "Stalled"
            : daysInStage > 18
              ? "At Risk"
              : "On Track";

      opportunities.push({
        id: `opp-${oppId++}`,
        name: `${acc.name} — ${product.name}`,
        accountId: acc.id,
        ownerId: owner.id,
        territoryId: owner.territoryId,
        productId: product.id,
        value,
        probability: probMap[stage] ?? 10,
        stage,
        createdAt: daysAgo(createdDaysAgo),
        expectedClose:
          stage === "Closed Won" || stage === "Closed Lost"
            ? closedAt!
            : daysAhead(randInt(5, 120)),
        closedAt,
        daysInStage,
        ageDays,
        nextAction:
          stage === "Closed Won" || stage === "Closed Lost"
            ? "—"
            : pick(NEXT_ACTIONS),
        riskStatus,
        lostReason,
        maxStageIndex,
        cycle,
        cohort,
      });
    }
  }

  // -- Campaigns -----------------------------------------------------------
  const campaignDefs = [
    { name: "Q3 Healthcare Expansion", channel: "Field Events" },
    { name: "Financial Services ABM", channel: "Account-Based" },
    { name: "Manufacturing Webinar Series", channel: "Webinar" },
    { name: "Compliance Thought Leadership", channel: "Content" },
    { name: "Retail Modernisation Push", channel: "Paid Search" },
    { name: "Energy Sector Roadshow", channel: "Field Events" },
  ];
  const campaigns: Campaign[] = campaignDefs.map((c, i) => {
    const leads = randInt(180, 900);
    const qualified = Math.round(leads * randFloat(0.28, 0.5));
    const meetings = Math.round(qualified * randFloat(0.4, 0.7));
    const proposals = Math.round(meetings * randFloat(0.35, 0.6));
    const closed = Math.round(proposals * randFloat(0.25, 0.5));
    const revenue = closed * randInt(45, 120) * 1000;
    const cost = randInt(20, 140) * 1000;
    return {
      id: `camp-${i + 1}`,
      name: c.name,
      channel: c.channel,
      cost,
      leadsGenerated: leads,
      qualifiedLeads: qualified,
      meetings,
      proposals,
      closedDeals: closed,
      revenue,
    };
  });

  // -- Market signals ------------------------------------------------------
  const marketSignals: MarketSignal[] = [
    {
      id: "mkt-1",
      industry: "Healthcare",
      signalType: "Demand surge",
      headline: "Healthcare digital-compliance spend accelerating",
      opportunity: "High",
      estimatedMarket: 2_400_000,
      penetration: 12,
      recommendedAction: "Launch a targeted healthcare compliance campaign",
    },
    {
      id: "mkt-2",
      industry: "Financial Services",
      signalType: "Competitive pressure",
      headline: "Incumbent competitor discounting in mid-market",
      opportunity: "Medium",
      estimatedMarket: 1_800_000,
      penetration: 34,
      recommendedAction: "Reinforce value messaging; protect top 10 accounts",
    },
    {
      id: "mkt-3",
      industry: "Manufacturing",
      signalType: "Economic headwind",
      headline: "Capex tightening softening manufacturing demand",
      opportunity: "Low",
      estimatedMarket: 900_000,
      penetration: 41,
      recommendedAction: "Shift focus to retention and efficiency messaging",
    },
    {
      id: "mkt-4",
      industry: "Technology",
      signalType: "Expansion",
      headline: "Mid-market tech firms increasing analytics budgets",
      opportunity: "High",
      estimatedMarket: 2_100_000,
      penetration: 19,
      recommendedAction: "Prioritise Analytics Suite cross-sell in Technology",
    },
    {
      id: "mkt-5",
      industry: "Energy",
      signalType: "Regulatory",
      headline: "New reporting mandates create compliance demand",
      opportunity: "Medium",
      estimatedMarket: 1_300_000,
      penetration: 22,
      recommendedAction: "Position Compliance Module ahead of mandate deadline",
    },
    {
      id: "mkt-6",
      industry: "Public Sector",
      signalType: "Budget cycle",
      headline: "Public sector procurement window opening next quarter",
      opportunity: "Medium",
      estimatedMarket: 1_600_000,
      penetration: 8,
      recommendedAction: "Begin early qualification of public sector pipeline",
    },
  ];

  // -- Revenue history (12 months, current ~ below target) -----------------
  const monthLabels = [
    "Sep", "Oct", "Nov", "Dec", "Jan", "Feb",
    "Mar", "Apr", "May", "Jun", "Jul", "Aug",
  ];
  // Monthly baseline chosen so ~3 months approximate the quarterly region
  // figures below, keeping the trend chart visually consistent with headlines.
  const baseTarget = 1_600_000;
  const revenueHistory = monthLabels.map((m, i) => {
    const target = Math.round(baseTarget * (1 + i * 0.012));
    // achievement drifts down over the year, ending below target
    const achievement = 1.04 - i * 0.016 + randFloat(-0.03, 0.03);
    const revenue = Math.round(target * achievement);
    const prevYear = Math.round(revenue * randFloat(0.86, 0.98));
    return { period: m, revenue, target, prevYear };
  });

  // -- Targets & actuals: skill-driven per-rep revenue model ---------------
  // Each rep has a quarterly quota and books revenue as a function of skill,
  // so achievement is realistic (David ~61%, top performers >100%) and the
  // region totals are the sum of the parts. Achievement = 0.45 + skill*0.6
  // (+noise) gives a region-wide average near 86% (below target).
  const salespersonTargets: Record<string, number> = {};
  const salespersonActuals: Record<string, number> = {};
  const salespersonPrevActuals: Record<string, number> = {};
  salespeople.forEach((sp) => {
    const skill = skillOf(sp);
    const target = randInt(400, 680) * 1000;
    const achievement = Math.max(0.35, Math.min(1.45, 0.45 + skill * 0.6 + randFloat(-0.05, 0.05)));
    const actual = Math.round(target * achievement);
    // previous period slightly different to create a trend
    const prevAchievement = Math.max(0.3, achievement + randFloat(-0.12, 0.08));
    salespersonTargets[sp.id] = target;
    salespersonActuals[sp.id] = actual;
    salespersonPrevActuals[sp.id] = Math.round(target * prevAchievement);
  });

  const regionTarget = Object.values(salespersonTargets).reduce((a, b) => a + b, 0);
  const regionRevenue = Object.values(salespersonActuals).reduce((a, b) => a + b, 0);
  const regionPrevRevenue = Object.values(salespersonPrevActuals).reduce((a, b) => a + b, 0);

  const territoryTargets: Record<string, number> = {};
  territories.forEach((t) => {
    territoryTargets[t.id] = salespeople
      .filter((sp) => sp.territoryId === t.id)
      .reduce((a, sp) => a + salespersonTargets[sp.id], 0);
  });

  return {
    region,
    territories,
    products,
    salespeople,
    accounts,
    opportunities,
    issues,
    campaigns,
    marketSignals,
    revenueHistory,
    salespersonTargets,
    salespersonActuals,
    salespersonPrevActuals,
    regionTarget,
    regionRevenue,
    regionPrevRevenue,
    territoryTargets,
    generatedAt: NOW.toISOString(),
  };
}
