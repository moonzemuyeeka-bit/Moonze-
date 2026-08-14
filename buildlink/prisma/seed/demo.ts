import type { OrderStatus, PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEMO_DELIVERY_PROVIDERS, DEMO_SUPPLIERS } from "./demo-catalogue";
import { suggestBudgetAllocation } from "../../src/lib/domain/budget";
import { calculateTrustScore } from "../../src/lib/domain/trust-score";
import { slugify } from "../../src/lib/utils";

/**
 * Demonstration accounts and trading history.
 *
 * The seed exists so a reviewer can open BuildLink and immediately see a working
 * marketplace: a customer with a half-built house and a real budget, suppliers
 * with catalogues, and orders spread across the lifecycle so every screen has
 * something honest to show.
 *
 * Two rules hold throughout:
 *  * Demo rows carry `isDemo: true` and a `[DEMO]` name prefix.
 *  * Nothing here fabricates a *successful online payment*. Payments are
 *    recorded offline (bank transfer / cash / mobile money confirmed by the
 *    supplier), which is exactly what happens on a deployment with no payment
 *    provider configured.
 */

/** Shared across every demo login, and printed at the end of the seed. */
export const DEMO_PASSWORD = "BuildLink2026!";

const DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY);
}

function toMinor(kwacha: number): number {
  return Math.round(kwacha * 100);
}

type SeedContext = {
  db: PrismaClient;
  passwordHash: string;
  provinceIdByCode: Map<string, string>;
  districtIdByName: Map<string, string>;
  categoryIdBySlug: Map<string, string>;
};

export async function seedDemoData(db: PrismaClient): Promise<void> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const provinces = await db.province.findMany({ select: { id: true, code: true } });
  const districts = await db.district.findMany({
    select: { id: true, name: true, province: { select: { code: true } } },
  });
  const categories = await db.productCategory.findMany({ select: { id: true, slug: true } });

  const context: SeedContext = {
    db,
    passwordHash,
    provinceIdByCode: new Map(provinces.map((row) => [row.code, row.id])),
    districtIdByName: new Map(
      districts.map((row) => [`${row.province.code}:${row.name}`, row.id]),
    ),
    categoryIdBySlug: new Map(categories.map((row) => [row.slug, row.id])),
  };

  await seedAdministrators(context);
  const supplierIds = await seedSuppliers(context);
  await seedDeliveryProviders(context);
  await seedCustomers(context, supplierIds);
}

// ---------------------------------------------------------------------------
// Staff accounts
// ---------------------------------------------------------------------------

async function upsertUser(
  context: SeedContext,
  input: {
    email: string;
    name: string;
    phone: string | null;
    role: UserRole;
  },
): Promise<string> {
  const user = await context.db.user.upsert({
    where: { email: input.email },
    update: { name: input.name, role: input.role, status: "ACTIVE" },
    create: {
      email: input.email,
      name: input.name,
      phone: input.phone,
      passwordHash: context.passwordHash,
      role: input.role,
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    },
    select: { id: true },
  });
  return user.id;
}

async function seedAdministrators(context: SeedContext): Promise<void> {
  await upsertUser(context, {
    email: "superadmin@buildlink.zm",
    name: "BuildLink Super Admin",
    phone: "+260970000001",
    role: "SUPER_ADMIN",
  });
  await upsertUser(context, {
    email: "admin@buildlink.zm",
    name: "BuildLink Admin",
    phone: "+260970000002",
    role: "ADMIN",
  });
}

// ---------------------------------------------------------------------------
// Suppliers and catalogues
// ---------------------------------------------------------------------------

async function seedSuppliers(context: SeedContext): Promise<Map<string, string>> {
  const supplierIdBySlug = new Map<string, string>();

  for (const supplier of DEMO_SUPPLIERS) {
    const provinceId = context.provinceIdByCode.get(supplier.provinceCode);
    if (!provinceId) throw new Error(`Unknown province code ${supplier.provinceCode}`);
    const districtId =
      context.districtIdByName.get(`${supplier.provinceCode}:${supplier.districtName}`) ?? null;

    const userId = await upsertUser(context, {
      email: supplier.email,
      name: supplier.contactName,
      phone: supplier.phone,
      role: "SUPPLIER",
    });

    const categoryIds = supplier.categorySlugs
      .map((slug) => context.categoryIdBySlug.get(slug))
      .filter((id): id is string => id !== undefined);

    const profile = await context.db.supplierProfile.upsert({
      where: { slug: supplier.slug },
      update: {
        businessName: supplier.businessName,
        description: supplier.description,
        verificationStatus: supplier.verificationStatus,
        verifiedAt: supplier.verificationStatus === "VERIFIED" ? daysAgo(120) : null,
        ratingAverageBps: Math.round(supplier.ratingAverage * 10_000),
        ratingCount: supplier.ratingCount,
        completedOrders: supplier.completedOrders,
        cancelledOrders: supplier.cancelledOrders,
        totalOrders: supplier.completedOrders + supplier.cancelledOrders,
        averageResponseMinutes: supplier.averageResponseMinutes,
        isPromoted: supplier.isPromoted,
        categories: { set: categoryIds.map((id) => ({ id })) },
      },
      create: {
        userId,
        businessName: supplier.businessName,
        slug: supplier.slug,
        description: supplier.description,
        phone: supplier.phone,
        email: supplier.email,
        provinceId,
        districtId,
        address: supplier.address,
        registrationNumber: supplier.registrationNumber,
        businessRegistrationStatus: supplier.registrationNumber
          ? supplier.verificationStatus === "VERIFIED"
            ? "VERIFIED"
            : "DOCUMENTS_SUBMITTED"
          : "NOT_PROVIDED",
        verificationStatus: supplier.verificationStatus,
        verifiedAt: supplier.verificationStatus === "VERIFIED" ? daysAgo(120) : null,
        yearsOperating: supplier.yearsOperating,
        deliveryAvailable: supplier.deliveryAvailable,
        deliveryNotes: supplier.deliveryNotes,
        minimumOrderMinor: toMinor(supplier.minimumOrder / 100),
        deliveryBaseFeeMinor: toMinor(supplier.deliveryBaseFee / 100),
        deliveryFreeAboveMinor:
          supplier.deliveryFreeAbove === null ? null : toMinor(supplier.deliveryFreeAbove / 100),
        ratingAverageBps: Math.round(supplier.ratingAverage * 10_000),
        ratingCount: supplier.ratingCount,
        completedOrders: supplier.completedOrders,
        cancelledOrders: supplier.cancelledOrders,
        totalOrders: supplier.completedOrders + supplier.cancelledOrders,
        averageResponseMinutes: supplier.averageResponseMinutes,
        isPromoted: supplier.isPromoted,
        isDemo: true,
        categories: { connect: categoryIds.map((id) => ({ id })) },
      },
      select: { id: true },
    });

    supplierIdBySlug.set(supplier.slug, profile.id);

    // The trust score is derived, never authored: compute it from the same
    // inputs the live recalculation uses so demo data cannot drift from the
    // real formula.
    const { score } = calculateTrustScore({
      verificationStatus: supplier.verificationStatus,
      ratingAverageBps: Math.round(supplier.ratingAverage * 10_000),
      ratingCount: supplier.ratingCount,
      completedOrders: supplier.completedOrders,
      cancelledOrders: supplier.cancelledOrders,
      totalOrders: supplier.completedOrders + supplier.cancelledOrders,
      deliveriesCompleted: Math.round(supplier.completedOrders * 0.94),
      deliveriesAttempted: supplier.completedOrders,
      openDisputes: 0,
      resolvedDisputes: supplier.cancelledOrders > 8 ? 1 : 0,
      averageResponseMinutes: supplier.averageResponseMinutes,
    });
    await context.db.supplierProfile.update({
      where: { id: profile.id },
      data: { trustScore: score },
    });

    if (supplier.verificationStatus !== "UNVERIFIED") {
      const existing = await context.db.supplierVerification.findFirst({
        where: { supplierId: profile.id },
        select: { id: true },
      });
      if (!existing) {
        await context.db.supplierVerification.create({
          data: {
            supplierId: profile.id,
            status: supplier.verificationStatus,
            submittedAt: daysAgo(130),
            reviewedAt: supplier.verificationStatus === "VERIFIED" ? daysAgo(120) : null,
            decisionNote:
              supplier.verificationStatus === "VERIFIED"
                ? "Demo record: PACRA certificate and tax clearance checked."
                : null,
          },
        });
      }
    }

    for (const product of supplier.products) {
      const categoryId = context.categoryIdBySlug.get(product.categorySlug);
      if (!categoryId) throw new Error(`Unknown category slug ${product.categorySlug}`);

      const slug = slugify(product.name);
      const record = await context.db.product.upsert({
        where: { supplierId_slug: { supplierId: profile.id, slug } },
        update: {
          name: product.name,
          categoryId,
          brand: product.brand,
          unit: product.unit,
          priceMinor: toMinor(product.price),
          description: product.description,
          stockQuantity: product.stock,
          minimumOrderQuantity: product.minimumOrderQuantity ?? 1,
          lowStockThreshold: product.lowStockThreshold ?? 0,
          deliveryAvailable: supplier.deliveryAvailable,
          status: "ACTIVE",
        },
        create: {
          supplierId: profile.id,
          categoryId,
          name: product.name,
          slug,
          description: product.description,
          brand: product.brand,
          unit: product.unit,
          priceMinor: toMinor(product.price),
          minimumOrderQuantity: product.minimumOrderQuantity ?? 1,
          stockQuantity: product.stock,
          lowStockThreshold: product.lowStockThreshold ?? 0,
          deliveryAvailable: supplier.deliveryAvailable,
          status: "ACTIVE",
          isDemo: true,
          viewCount: Math.round(product.stock / 7) + 12,
          purchaseCount: Math.round(product.stock / 40),
        },
        select: { id: true },
      });

      await context.db.inventory.upsert({
        where: { productId: record.id },
        update: { quantityOnHand: product.stock },
        create: {
          productId: record.id,
          quantityOnHand: product.stock,
          restockedAt: daysAgo(9),
        },
      });
    }
  }

  return supplierIdBySlug;
}

// ---------------------------------------------------------------------------
// Delivery providers
// ---------------------------------------------------------------------------

async function seedDeliveryProviders(context: SeedContext): Promise<void> {
  for (const provider of DEMO_DELIVERY_PROVIDERS) {
    const userId = await upsertUser(context, {
      email: provider.email,
      name: provider.contactName,
      phone: provider.phone,
      role: "DELIVERY_PROVIDER",
    });

    const record = await context.db.deliveryProvider.upsert({
      where: { userId },
      update: {
        businessName: provider.businessName,
        description: provider.description,
        verificationStatus: provider.verificationStatus,
        ratingAverageBps: Math.round(provider.ratingAverage * 10_000),
        ratingCount: provider.ratingCount,
        completedDeliveries: provider.completedDeliveries,
      },
      create: {
        userId,
        businessName: provider.businessName,
        type: provider.type,
        phone: provider.phone,
        description: provider.description,
        baseFeeMinor: toMinor(provider.baseFee / 100),
        perKilometreMinor: toMinor(provider.perKilometre / 100),
        verificationStatus: provider.verificationStatus,
        ratingAverageBps: Math.round(provider.ratingAverage * 10_000),
        ratingCount: provider.ratingCount,
        completedDeliveries: provider.completedDeliveries,
        isDemo: true,
      },
      select: { id: true },
    });

    for (const vehicle of provider.vehicles) {
      await context.db.vehicle.upsert({
        where: {
          providerId_registration: { providerId: record.id, registration: vehicle.registration },
        },
        update: { description: vehicle.description, isActive: true },
        create: {
          providerId: record.id,
          type: vehicle.type,
          registration: vehicle.registration,
          description: vehicle.description,
          capacityKg: vehicle.capacityKg,
          capacityCubicMetres: vehicle.capacityCubicMetres,
        },
      });
    }

    for (const area of provider.serviceAreas) {
      const provinceId = context.provinceIdByCode.get(area.provinceCode);
      if (!provinceId) continue;
      const districtId = area.districtName
        ? (context.districtIdByName.get(`${area.provinceCode}:${area.districtName}`) ?? null)
        : null;

      // A province-wide area has districtId null, and Postgres treats NULLs as
      // distinct in a unique index, so upsert-by-compound-key cannot be used.
      const existingArea = await context.db.serviceArea.findFirst({
        where: { providerId: record.id, provinceId, districtId },
        select: { id: true },
      });

      if (existingArea) {
        await context.db.serviceArea.update({
          where: { id: existingArea.id },
          data: { feeMinor: toMinor(area.fee / 100) },
        });
      } else {
        await context.db.serviceArea.create({
          data: {
            providerId: record.id,
            provinceId,
            districtId,
            feeMinor: toMinor(area.fee / 100),
          },
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Customers, projects and trading history
// ---------------------------------------------------------------------------

async function seedCustomers(
  context: SeedContext,
  supplierIdBySlug: Map<string, string>,
): Promise<void> {
  const lusakaId = context.provinceIdByCode.get("LSK");
  const kitweDistrictId = context.districtIdByName.get("CBT:Kitwe") ?? null;
  const copperbeltId = context.provinceIdByCode.get("CBT");
  const lusakaDistrictId = context.districtIdByName.get("LSK:Lusaka") ?? null;
  if (!lusakaId || !copperbeltId) throw new Error("Reference provinces are missing.");

  // --- Customer 1: mid-build house in Lusaka, with trading history ----------
  const chandaId = await upsertUser(context, {
    email: "customer@buildlink.zm",
    name: "Chanda Mulenga",
    phone: "+260977300101",
    role: "CUSTOMER",
  });

  await context.db.customerProfile.upsert({
    where: { userId: chandaId },
    update: { onboardingCompletedAt: daysAgo(150) },
    create: {
      userId: chandaId,
      phone: "+260977300101",
      provinceId: lusakaId,
      districtId: lusakaDistrictId,
      buildingIntent: "HOUSE",
      budgetRangeMinMinor: toMinor(600_000),
      budgetRangeMaxMinor: toMinor(900_000),
      currentStage: "ROOFING",
      onboardingCompletedAt: daysAgo(150),
    },
  });

  const houseProject = await upsertProject(context, {
    customerId: chandaId,
    name: "Family house — Chalala",
    propertyType: "HOUSE",
    constructionType: "NEW_BUILD",
    provinceId: lusakaId,
    districtId: lusakaDistrictId,
    locationDetail: "Chalala, off Joseph Mwilwa Road",
    bedrooms: 3,
    approximateSizeSqm: 165,
    stage: "ROOFING",
    status: "ACTIVE",
    estimatedBudget: 780_000,
    description:
      "Three-bedroom house on a 20 × 30 m plot. Foundation and walling complete, roof structure going up next. Aiming to move in before the rains.",
    startDate: daysAgo(148),
    targetCompletionDate: new Date(Date.now() + 120 * DAY),
    progressPercent: 46,
  });

  // A second project so the project switcher and dashboard are not degenerate.
  await upsertProject(context, {
    customerId: chandaId,
    name: "Boundary wall & gate",
    propertyType: "BOUNDARY_WALL",
    constructionType: "NEW_BUILD",
    provinceId: lusakaId,
    districtId: lusakaDistrictId,
    locationDetail: "Same plot, Chalala",
    bedrooms: null,
    approximateSizeSqm: null,
    stage: "PLANNING",
    status: "PLANNING",
    estimatedBudget: 95_000,
    description: "120 m of 2.4 m block wall with a steel sliding gate, once the house is roofed.",
    startDate: null,
    targetCompletionDate: null,
    progressPercent: 4,
  });

  await seedBudgetSpend(context, houseProject.id, houseProject.budgetId);
  await seedWalletLedger(context, houseProject.id, chandaId);
  await seedTradingHistory(context, {
    customerId: chandaId,
    projectId: houseProject.id,
    supplierIdBySlug,
    provinceId: lusakaId,
    districtId: lusakaDistrictId,
  });

  // --- Customer 2: renovation, fresh account with an empty-ish dashboard ----
  const bwalyaId = await upsertUser(context, {
    email: "renovator@buildlink.zm",
    name: "Bwalya Nkonde",
    phone: "+260966300202",
    role: "CUSTOMER",
  });

  await context.db.customerProfile.upsert({
    where: { userId: bwalyaId },
    update: {},
    create: {
      userId: bwalyaId,
      phone: "+260966300202",
      provinceId: copperbeltId,
      districtId: kitweDistrictId,
      buildingIntent: "RENOVATION",
      budgetRangeMinMinor: toMinor(80_000),
      budgetRangeMaxMinor: toMinor(150_000),
      currentStage: "PLANNING",
      onboardingCompletedAt: daysAgo(6),
    },
  });

  await upsertProject(context, {
    customerId: bwalyaId,
    name: "Kitwe house renovation",
    propertyType: "RENOVATION",
    constructionType: "RENOVATION",
    provinceId: copperbeltId,
    districtId: kitweDistrictId,
    locationDetail: "Riverside, Kitwe",
    bedrooms: 3,
    approximateSizeSqm: 140,
    stage: "PLANNING",
    status: "PLANNING",
    estimatedBudget: 120_000,
    description:
      "Re-roof, rewire and retile a 1970s house. Kitchen and both bathrooms to be redone.",
    startDate: null,
    targetCompletionDate: new Date(Date.now() + 90 * DAY),
    progressPercent: 2,
  });
}

async function upsertProject(
  context: SeedContext,
  input: {
    customerId: string;
    name: string;
    propertyType: "HOUSE" | "APARTMENT" | "RENOVATION" | "COMMERCIAL" | "BOUNDARY_WALL" | "OTHER";
    constructionType: "NEW_BUILD" | "RENOVATION" | "EXTENSION" | "FINISHING_ONLY" | "OTHER";
    provinceId: string;
    districtId: string | null;
    locationDetail: string | null;
    bedrooms: number | null;
    approximateSizeSqm: number | null;
    stage:
      | "PLANNING"
      | "SITE_PREPARATION"
      | "FOUNDATION"
      | "WALLING"
      | "ROOFING"
      | "PLUMBING"
      | "ELECTRICAL"
      | "PLASTERING"
      | "FLOORING"
      | "PAINTING"
      | "FINISHING"
      | "COMPLETED";
    status: "PLANNING" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
    estimatedBudget: number;
    description: string;
    startDate: Date | null;
    targetCompletionDate: Date | null;
    progressPercent: number;
  },
): Promise<{ id: string; budgetId: string }> {
  const existing = await context.db.project.findFirst({
    where: { customerId: input.customerId, name: input.name },
    select: { id: true, budget: { select: { id: true } } },
  });

  const estimatedBudgetMinor = toMinor(input.estimatedBudget);

  const project =
    existing ??
    (await context.db.project.create({
      data: {
        customerId: input.customerId,
        name: input.name,
        propertyType: input.propertyType,
        constructionType: input.constructionType,
        provinceId: input.provinceId,
        districtId: input.districtId,
        locationDetail: input.locationDetail,
        bedrooms: input.bedrooms,
        approximateSizeSqm: input.approximateSizeSqm,
        stage: input.stage,
        status: input.status,
        estimatedBudgetMinor,
        description: input.description,
        startDate: input.startDate,
        targetCompletionDate: input.targetCompletionDate,
        progressPercent: input.progressPercent,
        createdAt: input.startDate ?? daysAgo(7),
      },
      select: { id: true, budget: { select: { id: true } } },
    }));

  let budgetId = project.budget?.id;
  if (!budgetId) {
    const budget = await context.db.projectBudget.create({
      data: { projectId: project.id },
      select: { id: true },
    });
    budgetId = budget.id;

    for (const allocation of suggestBudgetAllocation(estimatedBudgetMinor, input.propertyType)) {
      await context.db.budgetCategory.create({
        data: {
          budgetId,
          key: allocation.key,
          plannedMinor: allocation.plannedMinor,
          sortOrder: allocation.sortOrder,
        },
      });
    }
  }

  return { id: project.id, budgetId };
}

/** Spend the mid-build project has already booked, by category. */
async function seedBudgetSpend(
  context: SeedContext,
  projectId: string,
  budgetId: string,
): Promise<void> {
  const existing = await context.db.budgetTransaction.count({ where: { projectId } });
  if (existing > 0) return;

  const categories = await context.db.budgetCategory.findMany({
    where: { budgetId },
    select: { id: true, key: true },
  });
  const categoryId = (key: string) => categories.find((row) => row.key === key)?.id ?? null;

  const entries: Array<{
    key: string;
    amount: number;
    description: string;
    days: number;
    type: "EXPENSE" | "MATERIAL_PURCHASE";
  }> = [
    {
      key: "LAND_AND_SITE_PREPARATION",
      amount: 34_500,
      description: "Site clearing, setting out and pit latrine for the crew",
      days: 146,
      type: "EXPENSE",
    },
    {
      key: "FOUNDATION",
      amount: 78_200,
      description: "Foundation excavation, hardcore, blinding and strip footing concrete",
      days: 132,
      type: "MATERIAL_PURCHASE",
    },
    {
      key: "FOUNDATION",
      amount: 12_400,
      description: "Damp proof course and foundation walling blocks",
      days: 121,
      type: "MATERIAL_PURCHASE",
    },
    {
      key: "WALLING",
      amount: 96_800,
      description: "Blocks, cement and sand for superstructure walling to wall plate",
      days: 92,
      type: "MATERIAL_PURCHASE",
    },
    {
      key: "WALLING",
      amount: 18_600,
      description: "Brickforce, lintels and ring beam reinforcement",
      days: 74,
      type: "MATERIAL_PURCHASE",
    },
    {
      key: "LABOUR",
      amount: 62_000,
      description: "Bricklaying gang — foundation through wall plate",
      days: 70,
      type: "EXPENSE",
    },
    {
      key: "PROFESSIONAL_FEES",
      amount: 21_500,
      description: "Architectural drawings and council plan approval",
      days: 156,
      type: "EXPENSE",
    },
    {
      key: "TRANSPORT",
      amount: 9_800,
      description: "Tipper hire for sand and stone deliveries",
      days: 88,
      type: "EXPENSE",
    },
    {
      key: "ROOFING",
      amount: 41_300,
      description: "Roof timber delivered to site",
      days: 12,
      type: "MATERIAL_PURCHASE",
    },
  ];

  for (const entry of entries) {
    await context.db.budgetTransaction.create({
      data: {
        projectId,
        categoryId: categoryId(entry.key),
        type: entry.type,
        amountMinor: toMinor(entry.amount),
        description: entry.description,
        occurredAt: daysAgo(entry.days),
      },
    });
  }
}

async function seedWalletLedger(
  context: SeedContext,
  projectId: string,
  customerId: string,
): Promise<void> {
  const existing = await context.db.walletEntry.count({ where: { projectId } });
  if (existing > 0) return;

  const entries: Array<{
    type: "DEPOSIT_RECORDED" | "ALLOCATION" | "ALLOCATION_RELEASED";
    amount: number;
    description: string;
    days: number;
    reference: string | null;
  }> = [
    {
      type: "DEPOSIT_RECORDED",
      amount: 250_000,
      description: "Savings moved to the build account",
      days: 150,
      reference: "Own savings",
    },
    {
      type: "DEPOSIT_RECORDED",
      amount: 180_000,
      description: "Second tranche from plot sale",
      days: 96,
      reference: "Plot sale proceeds",
    },
    {
      type: "ALLOCATION",
      amount: 96_800,
      description: "Committed to walling materials",
      days: 92,
      reference: null,
    },
    {
      type: "DEPOSIT_RECORDED",
      amount: 120_000,
      description: "Third tranche — bonus and family contribution",
      days: 30,
      reference: "Bonus + family",
    },
    {
      type: "ALLOCATION",
      amount: 41_300,
      description: "Committed to roof timber",
      days: 12,
      reference: null,
    },
  ];

  for (const entry of entries) {
    await context.db.walletEntry.create({
      data: {
        projectId,
        type: entry.type,
        amountMinor: toMinor(entry.amount),
        description: entry.description,
        reference: entry.reference,
        createdById: customerId,
        createdAt: daysAgo(entry.days),
      },
    });
  }
}

/**
 * Orders across the lifecycle, so the customer's order list, the supplier
 * console, deliveries, contracts and reviews all have real records to render.
 */
async function seedTradingHistory(
  context: SeedContext,
  input: {
    customerId: string;
    projectId: string;
    supplierIdBySlug: Map<string, string>;
    provinceId: string;
    districtId: string | null;
  },
): Promise<void> {
  const existing = await context.db.order.count({ where: { customerId: input.customerId } });
  if (existing > 0) return;

  const plan: Array<{
    supplierSlug: string;
    status: OrderStatus;
    daysAgo: number;
    fulfilment: "SUPPLIER_DELIVERY" | "CUSTOMER_PICKUP";
    items: Array<{ productName: string; quantity: number }>;
    review?: { rating: number; comment: string };
    withContract?: boolean;
  }> = [
    {
      supplierSlug: "zambezi-cement-and-aggregates",
      status: "COMPLETED",
      daysAgo: 94,
      fulfilment: "SUPPLIER_DELIVERY",
      items: [
        { productName: "Portland Cement 32.5N — 50 kg bag", quantity: 120 },
        { productName: "River Sand — 7 ton tipper load", quantity: 3 },
        { productName: "Crushed Stone 19 mm — per ton", quantity: 14 },
      ],
      review: {
        rating: 5,
        comment:
          "Cement arrived the next morning and the tipper driver found the plot without any trouble. Weighbridge tickets for the stone were in the cab, which I appreciated.",
      },
      withContract: true,
    },
    {
      supplierSlug: "kalulushi-block-works",
      status: "COMPLETED",
      daysAgo: 88,
      fulfilment: "SUPPLIER_DELIVERY",
      items: [
        { productName: "Concrete Block 6 inch (150 mm) — solid", quantity: 2600 },
        { productName: "Precast Lintel 150 × 100 mm — 1.2 m", quantity: 8 },
      ],
      review: {
        rating: 4,
        comment:
          "Blocks were well cured and square. Delivery came a day later than promised, but they called ahead to tell me.",
      },
      withContract: true,
    },
    {
      supplierSlug: "great-north-roofing-and-steel",
      status: "OUT_FOR_DELIVERY",
      daysAgo: 3,
      fulfilment: "SUPPLIER_DELIVERY",
      items: [
        { productName: "IBR Roofing Sheet 0.47 mm — per linear metre", quantity: 96 },
        { productName: "Ridge Cap 0.47 mm — 1.8 m length", quantity: 8 },
        { productName: "Roofing Screw 65 mm with EPDM washer — box of 100", quantity: 4 },
      ],
      withContract: true,
    },
    {
      supplierSlug: "chipata-timber-and-board",
      status: "CONFIRMED",
      daysAgo: 2,
      fulfilment: "CUSTOMER_PICKUP",
      items: [
        { productName: "Roof Rafter 50 × 76 mm — 6 m", quantity: 60 },
        { productName: "Roof Purlin 38 × 50 mm — 6 m", quantity: 120 },
      ],
    },
    {
      supplierSlug: "lusaka-tile-and-paint-centre",
      status: "PENDING_PAYMENT",
      daysAgo: 0,
      fulfilment: "SUPPLIER_DELIVERY",
      items: [
        { productName: "PVA Interior Paint 20 litre — brilliant white", quantity: 4 },
        { productName: "Universal Undercoat 5 litre", quantity: 3 },
      ],
    },
  ];

  let sequence = 1;

  for (const entry of plan) {
    const supplierId = input.supplierIdBySlug.get(entry.supplierSlug);
    if (!supplierId) continue;

    const supplier = await context.db.supplierProfile.findUniqueOrThrow({
      where: { id: supplierId },
      select: {
        id: true,
        userId: true,
        businessName: true,
        deliveryBaseFeeMinor: true,
        deliveryFreeAboveMinor: true,
        deliveryAvailable: true,
      },
    });

    const products = await context.db.product.findMany({
      where: {
        supplierId,
        name: { in: entry.items.map((item) => item.productName) },
      },
      select: { id: true, name: true, brand: true, unit: true, priceMinor: true },
    });

    const items = entry.items.flatMap((item) => {
      const product = products.find((candidate) => candidate.name === item.productName);
      if (!product) return [];
      return [
        {
          productId: product.id,
          productName: product.name,
          brand: product.brand,
          unit: product.unit,
          unitPriceMinor: product.priceMinor,
          quantity: item.quantity,
          lineTotalMinor: product.priceMinor * item.quantity,
        },
      ];
    });
    if (items.length === 0) continue;

    const subtotalMinor = items.reduce((total, item) => total + item.lineTotalMinor, 0);
    const deliveryFeeMinor =
      entry.fulfilment === "CUSTOMER_PICKUP" || !supplier.deliveryAvailable
        ? 0
        : supplier.deliveryFreeAboveMinor !== null &&
            subtotalMinor >= supplier.deliveryFreeAboveMinor
          ? 0
          : supplier.deliveryBaseFeeMinor;
    const totalMinor = subtotalMinor + deliveryFeeMinor;
    const placedAt = daysAgo(entry.daysAgo);

    const order = await context.db.order.create({
      data: {
        orderNumber: `BL-DEMO-${String(sequence).padStart(4, "0")}`,
        customerId: input.customerId,
        supplierId,
        projectId: input.projectId,
        status: entry.status,
        subtotalMinor,
        deliveryFeeMinor,
        totalMinor,
        fulfilmentMethod: entry.fulfilment,
        customerNote:
          entry.fulfilment === "CUSTOMER_PICKUP"
            ? "I will collect with a hired truck — please have it bundled."
            : "Plot is on the left after the water tank. Call on arrival.",
        placedAt,
        confirmedAt: statusReached(entry.status, "CONFIRMED") ? addHours(placedAt, 5) : null,
        completedAt: entry.status === "COMPLETED" ? addDays(placedAt, 4) : null,
        createdAt: placedAt,
        items: { create: items },
      },
      select: { id: true, orderNumber: true, status: true },
    });
    sequence += 1;

    await seedOrderEvents(context, order.id, entry.status, placedAt);

    // Every order that got past the customer's hands has a recorded payment:
    // money that moved directly to the supplier, confirmed by the supplier.
    if (statusReached(entry.status, "CONFIRMED")) {
      const payment = await context.db.payment.create({
        data: {
          reference: `PMT-${order.orderNumber}`,
          orderId: order.id,
          projectId: input.projectId,
          customerId: input.customerId,
          supplierId,
          method: "RECORDED_BANK_TRANSFER",
          status: "SUCCESSFUL",
          amountMinor: totalMinor,
          provider: null,
          idempotencyKey: `demo-${order.orderNumber}`,
          confirmedById: supplier.userId,
          confirmedAt: addHours(placedAt, 5),
          createdAt: addHours(placedAt, 1),
        },
        select: { id: true },
      });

      await context.db.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          fromStatus: null,
          toStatus: "INITIATED",
          amountMinor: totalMinor,
          occurredAt: addHours(placedAt, 1),
        },
      });
      await context.db.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          fromStatus: "INITIATED",
          toStatus: "SUCCESSFUL",
          amountMinor: totalMinor,
          actorUserId: supplier.userId,
          occurredAt: addHours(placedAt, 5),
        },
      });
    }

    if (entry.withContract) {
      await seedContract(context, {
        order,
        customerId: input.customerId,
        supplierId,
        supplierUserId: supplier.userId,
        projectId: input.projectId,
        subtotalMinor,
        deliveryFeeMinor,
        totalMinor,
        items,
        placedAt,
      });
    }

    if (entry.fulfilment === "SUPPLIER_DELIVERY") {
      await seedDelivery(context, {
        orderId: order.id,
        status: entry.status,
        provinceId: input.provinceId,
        districtId: input.districtId,
        feeMinor: deliveryFeeMinor,
        placedAt,
      });
    }

    if (entry.review) {
      await context.db.review.create({
        data: {
          orderId: order.id,
          customerId: input.customerId,
          supplierId,
          rating: entry.review.rating,
          productQualityRating: entry.review.rating,
          priceRating: Math.max(3, entry.review.rating - 1),
          deliveryRating: entry.review.rating,
          communicationRating: entry.review.rating,
          reliabilityRating: entry.review.rating,
          comment: entry.review.comment,
          createdAt: addDays(placedAt, 6),
        },
      });
    }
  }
}

const ORDER_PROGRESSION: OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "PROCESSING",
  "READY_FOR_DELIVERY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "COMPLETED",
];

function statusReached(current: OrderStatus, target: OrderStatus): boolean {
  const currentIndex = ORDER_PROGRESSION.indexOf(current);
  const targetIndex = ORDER_PROGRESSION.indexOf(target);
  if (currentIndex === -1 || targetIndex === -1) return false;
  return currentIndex >= targetIndex;
}

async function seedOrderEvents(
  context: SeedContext,
  orderId: string,
  status: OrderStatus,
  placedAt: Date,
): Promise<void> {
  const reachedIndex = ORDER_PROGRESSION.indexOf(status);
  if (reachedIndex === -1) return;

  const hoursPerStep = [0, 1, 5, 8, 26, 30, 34, 96];
  let previous: OrderStatus | null = null;

  for (let index = 0; index <= reachedIndex; index += 1) {
    const toStatus = ORDER_PROGRESSION[index];
    if (!toStatus) continue;
    // PAYMENT_PENDING only appears when a payment was actually initiated.
    if (toStatus === "PAYMENT_PENDING" && reachedIndex < 2) continue;

    await context.db.orderEvent.create({
      data: {
        orderId,
        fromStatus: previous,
        toStatus,
        note: eventNote(toStatus),
        createdAt: addHours(placedAt, hoursPerStep[index] ?? index * 4),
      },
    });
    previous = toStatus;
  }
}

function eventNote(status: OrderStatus): string | null {
  switch (status) {
    case "PENDING_PAYMENT":
      return "Order placed on BuildLink.";
    case "PAYMENT_PENDING":
      return "Bank transfer recorded by the customer, awaiting supplier confirmation.";
    case "CONFIRMED":
      return "Supplier confirmed payment received and accepted the order.";
    case "PROCESSING":
      return "Order being picked and loaded.";
    case "READY_FOR_DELIVERY":
      return "Loaded and ready to leave the yard.";
    case "OUT_FOR_DELIVERY":
      return "On the way to site.";
    case "DELIVERED":
      return "Delivered and signed for on site.";
    case "COMPLETED":
      return "Customer confirmed the order is complete.";
    default:
      return null;
  }
}

async function seedContract(
  context: SeedContext,
  input: {
    order: { id: string; orderNumber: string; status: OrderStatus };
    customerId: string;
    supplierId: string;
    supplierUserId: string;
    projectId: string;
    subtotalMinor: number;
    deliveryFeeMinor: number;
    totalMinor: number;
    items: Array<{
      productId: string;
      productName: string;
      unit: "BAG" | "PIECE" | "TON" | "CUBIC_METRE" | "TRUCK" | "METRE" | "KILOGRAM" | "BOX" | "BUNDLE" | "SHEET" | "LITRE" | "OTHER";
      unitPriceMinor: number;
      quantity: number;
      lineTotalMinor: number;
    }>;
    placedAt: Date;
  },
): Promise<void> {
  const accepted = statusReached(input.order.status, "CONFIRMED");

  const contract = await context.db.contract.create({
    data: {
      contractNumber: `AGR-${input.order.orderNumber}`,
      orderId: input.order.id,
      customerId: input.customerId,
      supplierId: input.supplierId,
      projectId: input.projectId,
      status: accepted ? (input.order.status === "COMPLETED" ? "COMPLETED" : "ACCEPTED") : "SENT",
      subtotalMinor: input.subtotalMinor,
      depositMinor: Math.round(input.totalMinor / 2),
      balanceMinor: input.totalMinor - Math.round(input.totalMinor / 2),
      deliveryFeeMinor: input.deliveryFeeMinor,
      totalMinor: input.totalMinor,
      deliveryDate: addDays(input.placedAt, 3),
      deliveryLocation: "Chalala, off Joseph Mwilwa Road, Lusaka",
      terms: DEMO_TERMS,
      cancellationTerms: DEMO_CANCELLATION_TERMS,
      sentAt: addHours(input.placedAt, 1),
      respondedAt: accepted ? addHours(input.placedAt, 4) : null,
      completedAt: input.order.status === "COMPLETED" ? addDays(input.placedAt, 4) : null,
      createdAt: addHours(input.placedAt, 1),
      items: {
        create: input.items.map((item) => ({
          productId: item.productId,
          description: item.productName,
          unit: item.unit,
          quantity: item.quantity,
          unitPriceMinor: item.unitPriceMinor,
          lineTotalMinor: item.lineTotalMinor,
        })),
      },
    },
    select: { id: true },
  });

  if (accepted) {
    await context.db.contractAcceptance.create({
      data: {
        contractId: contract.id,
        userId: input.supplierUserId,
        role: "SUPPLIER",
        contractVersion: 1,
        accepted: true,
        signatureName: "Demo Supplier Representative",
        acceptedAt: addHours(input.placedAt, 2),
      },
    });
    await context.db.contractAcceptance.create({
      data: {
        contractId: contract.id,
        userId: input.customerId,
        role: "CUSTOMER",
        contractVersion: 1,
        accepted: true,
        signatureName: "Chanda Mulenga",
        acceptedAt: addHours(input.placedAt, 4),
      },
    });
  }
}

async function seedDelivery(
  context: SeedContext,
  input: {
    orderId: string;
    status: OrderStatus;
    provinceId: string;
    districtId: string | null;
    feeMinor: number;
    placedAt: Date;
  },
): Promise<void> {
  const deliveryStatus = (() => {
    if (input.status === "COMPLETED" || input.status === "DELIVERED") return "DELIVERED" as const;
    if (input.status === "OUT_FOR_DELIVERY") return "IN_TRANSIT" as const;
    if (statusReached(input.status, "READY_FOR_DELIVERY")) return "ACCEPTED" as const;
    return "REQUESTED" as const;
  })();

  const delivery = await context.db.delivery.create({
    data: {
      orderId: input.orderId,
      method: "SUPPLIER_DELIVERY",
      status: deliveryStatus,
      addressLine: "Plot 4821, Chalala",
      provinceId: input.provinceId,
      districtId: input.districtId,
      locationDetail: "Off Joseph Mwilwa Road, second turn after the water tank",
      contactName: "Chanda Mulenga",
      contactPhone: "+260977300101",
      instructions: "Call on arrival — the gate is not yet hung.",
      feeMinor: input.feeMinor,
      scheduledFor: addDays(input.placedAt, 2),
      pickedUpAt: deliveryStatus === "DELIVERED" || deliveryStatus === "IN_TRANSIT"
        ? addHours(input.placedAt, 30)
        : null,
      deliveredAt: deliveryStatus === "DELIVERED" ? addHours(input.placedAt, 34) : null,
      receivedBy: deliveryStatus === "DELIVERED" ? "Chanda Mulenga" : null,
      createdAt: addHours(input.placedAt, 1),
    },
    select: { id: true },
  });

  const progression = ["REQUESTED", "ACCEPTED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"] as const;
  const reachedIndex = progression.indexOf(deliveryStatus as (typeof progression)[number]);
  let previous: (typeof progression)[number] | null = null;

  for (let index = 0; index <= reachedIndex; index += 1) {
    const toStatus = progression[index];
    if (!toStatus) continue;
    await context.db.deliveryEvent.create({
      data: {
        deliveryId: delivery.id,
        fromStatus: previous,
        toStatus,
        createdAt: addHours(input.placedAt, 2 + index * 8),
      },
    });
    previous = toStatus;
  }
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY);
}

const DEMO_TERMS = [
  "1. The supplier will supply the goods listed in this agreement at the prices shown, in Zambian Kwacha.",
  "2. Payment is made directly to the supplier. BuildLink records the payment but does not hold or transmit funds.",
  "3. Quantities and prices are fixed for 7 days from the date this agreement is sent.",
  "4. The customer will inspect the goods on delivery and record any shortfall or damage before signing.",
  "5. Risk in the goods passes to the customer on delivery or collection.",
].join("\n");

const DEMO_CANCELLATION_TERMS = [
  "1. Either party may cancel before the supplier begins loading, at no cost.",
  "2. After loading has begun, the supplier may retain reasonable handling and transport costs already incurred.",
  "3. Goods manufactured or cut to order cannot be cancelled once production has started.",
].join("\n");
