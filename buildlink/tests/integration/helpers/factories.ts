import type {
  OrderStatus,
  ProductUnit,
  PropertyType,
  UserRole,
  VerificationStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { toMinor } from "@/lib/money";
import { currentCookies } from "./request-context";

/**
 * Test data builders.
 *
 * Each builder creates the smallest valid row and lets a test override exactly
 * the field it is about, so a failing assertion points at the behaviour rather
 * than at scaffolding.
 */

let counter = 0;
function unique(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

export const TEST_PASSWORD = "Ntemba-Build-2026";

export async function createProvince(name = unique("Province")) {
  return db.province.create({
    data: {
      name,
      code: unique("PR").slice(0, 12).toUpperCase(),
      latitude: -15.4167,
      longitude: 28.2833,
      districts: {
        create: { name: `${name} Central`, latitude: -15.4167, longitude: 28.2833 },
      },
    },
    include: { districts: true },
  });
}

export type LocationFixture = {
  provinceId: string;
  districtId: string;
};

export async function createLocation(): Promise<LocationFixture> {
  const province = await createProvince();
  return { provinceId: province.id, districtId: province.districts[0]!.id };
}

export async function createCategory(name = "Cement & Concrete") {
  return db.productCategory.create({
    data: { name, slug: unique("cement-concrete"), iconName: "cement" },
  });
}

export async function createUser(
  overrides: {
    role?: UserRole;
    email?: string;
    name?: string;
    password?: string;
    phone?: string | null;
    status?: "ACTIVE" | "PENDING_VERIFICATION" | "SUSPENDED" | "DEACTIVATED";
    withCustomerProfile?: boolean;
    onboardingCompleted?: boolean;
  } = {},
) {
  const role = overrides.role ?? "CUSTOMER";
  const passwordHash = await hashPassword(overrides.password ?? TEST_PASSWORD);

  return db.user.create({
    data: {
      email: overrides.email ?? `${unique("user")}@buildlink.test`,
      name: overrides.name ?? "Chanda Mulenga",
      phone: overrides.phone ?? null,
      passwordHash,
      role,
      status: overrides.status ?? "ACTIVE",
      customerProfile:
        overrides.withCustomerProfile ?? role === "CUSTOMER"
          ? {
              create: {
                onboardingCompletedAt: overrides.onboardingCompleted ? new Date() : null,
              },
            }
          : undefined,
    },
  });
}

export async function createSupplier(
  overrides: {
    businessName?: string;
    verificationStatus?: VerificationStatus;
    provinceId?: string;
    districtId?: string | null;
    deliveryAvailable?: boolean;
    minimumOrderMinor?: number;
    deliveryBaseFeeMinor?: number;
    deliveryFreeAboveMinor?: number | null;
    commissionRateBps?: number | null;
    isDemo?: boolean;
    ratingAverageBps?: number;
    ratingCount?: number;
    completedOrders?: number;
  } = {},
) {
  const location = overrides.provinceId
    ? { provinceId: overrides.provinceId, districtId: overrides.districtId ?? null }
    : await createLocation();

  const user = await createUser({ role: "SUPPLIER", name: "Mwansa Banda" });
  const businessName = overrides.businessName ?? "Kabwe Building Supplies";

  const supplier = await db.supplierProfile.create({
    data: {
      userId: user.id,
      businessName,
      slug: unique("supplier"),
      phone: "+260977000111",
      email: user.email,
      provinceId: location.provinceId,
      districtId: location.districtId ?? null,
      verificationStatus: overrides.verificationStatus ?? "VERIFIED",
      verifiedAt: (overrides.verificationStatus ?? "VERIFIED") === "VERIFIED" ? new Date() : null,
      deliveryAvailable: overrides.deliveryAvailable ?? true,
      minimumOrderMinor: overrides.minimumOrderMinor ?? 0,
      deliveryBaseFeeMinor: overrides.deliveryBaseFeeMinor ?? toMinor(250),
      deliveryFreeAboveMinor: overrides.deliveryFreeAboveMinor ?? null,
      commissionRateBps: overrides.commissionRateBps ?? null,
      isDemo: overrides.isDemo ?? false,
      ratingAverageBps: overrides.ratingAverageBps ?? 0,
      ratingCount: overrides.ratingCount ?? 0,
      completedOrders: overrides.completedOrders ?? 0,
    },
  });

  return { supplier, user, location };
}

export async function createProduct(
  supplierId: string,
  overrides: {
    name?: string;
    brand?: string | null;
    categoryId?: string;
    unit?: ProductUnit;
    priceMinor?: number;
    stockQuantity?: number;
    minimumOrderQuantity?: number;
    status?: "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "INACTIVE" | "REJECTED" | "ARCHIVED";
    deliveryAvailable?: boolean;
    isDemo?: boolean;
  } = {},
) {
  const categoryId = overrides.categoryId ?? (await createCategory()).id;

  return db.product.create({
    data: {
      supplierId,
      categoryId,
      name: overrides.name ?? "Cement 32.5N 50kg",
      slug: unique("product"),
      brand: overrides.brand ?? "Lafarge",
      unit: overrides.unit ?? "BAG",
      priceMinor: overrides.priceMinor ?? toMinor(240),
      stockQuantity: overrides.stockQuantity ?? 500,
      minimumOrderQuantity: overrides.minimumOrderQuantity ?? 1,
      status: overrides.status ?? "ACTIVE",
      deliveryAvailable: overrides.deliveryAvailable ?? true,
      isDemo: overrides.isDemo ?? false,
    },
  });
}

export async function createProject(
  customerId: string,
  overrides: {
    name?: string;
    propertyType?: PropertyType;
    provinceId?: string;
    districtId?: string | null;
    estimatedBudgetMinor?: number;
  } = {},
) {
  const location = overrides.provinceId
    ? { provinceId: overrides.provinceId, districtId: overrides.districtId ?? null }
    : await createLocation();

  return db.project.create({
    data: {
      customerId,
      name: overrides.name ?? "Chalala three-bedroom house",
      propertyType: overrides.propertyType ?? "HOUSE",
      provinceId: location.provinceId,
      districtId: location.districtId ?? null,
      estimatedBudgetMinor: overrides.estimatedBudgetMinor ?? toMinor(750_000),
      budget: { create: {} },
    },
    include: { budget: true },
  });
}

export async function createOrder(input: {
  customerId: string;
  supplierId: string;
  projectId?: string | null;
  status?: OrderStatus;
  subtotalMinor?: number;
  deliveryFeeMinor?: number;
}) {
  const subtotalMinor = input.subtotalMinor ?? toMinor(2_400);
  const deliveryFeeMinor = input.deliveryFeeMinor ?? 0;

  return db.order.create({
    data: {
      orderNumber: unique("BL").toUpperCase(),
      customerId: input.customerId,
      supplierId: input.supplierId,
      projectId: input.projectId ?? null,
      status: input.status ?? "PENDING_PAYMENT",
      subtotalMinor,
      deliveryFeeMinor,
      totalMinor: subtotalMinor + deliveryFeeMinor,
      placedAt: new Date(),
      items: {
        create: {
          productName: "Cement 32.5N 50kg",
          brand: "Lafarge",
          unit: "BAG",
          unitPriceMinor: toMinor(240),
          quantity: 10,
          lineTotalMinor: toMinor(2_400),
        },
      },
      events: { create: { toStatus: input.status ?? "PENDING_PAYMENT" } },
    },
    include: { items: true },
  });
}

/**
 * Signs the given user in for the remainder of the test by creating a real
 * session row and putting the real cookie in the test jar — the same path the
 * browser takes, so session expiry and revocation behave as they do in
 * production.
 */
export async function signIn(userId: string): Promise<void> {
  await createSession(userId);
}

export function signOut(): void {
  currentCookies().clear();
}

/** Seeds the platform settings a code path may read, without the full seed. */
export async function setPlatformSetting(key: string, value: unknown, description = "Test setting") {
  return db.platformSetting.upsert({
    where: { key },
    update: { value: value as never },
    create: { key, value: value as never, description },
  });
}
