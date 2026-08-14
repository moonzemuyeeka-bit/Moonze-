import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import {
  PLATFORM_SETTING_DEFAULTS,
  type PlatformSettingKey,
  type PlatformSettings,
} from "@/lib/platform-settings";

/**
 * Reference-data queries.
 *
 * Provinces, districts and categories change roughly never, so each loader is
 * wrapped in React's request-level `cache` and the results are safe to pass into
 * client components (plain objects only).
 */

export type ProvinceOption = {
  id: string;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  districts: Array<{ id: string; name: string; latitude: number; longitude: number }>;
};

export const getProvinces = cache(async (): Promise<ProvinceOption[]> => {
  const provinces = await db.province.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      latitude: true,
      longitude: true,
      districts: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, latitude: true, longitude: true },
      },
    },
  });
  return provinces;
});

export type CategoryOption = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconName: string | null;
  productCount: number;
  children: Array<{ id: string; name: string; slug: string }>;
};

/** Top-level categories with their subcategories and live product counts. */
export const getCategories = cache(async (): Promise<CategoryOption[]> => {
  const categories = await db.productCategory.findMany({
    where: { parentId: null, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      iconName: true,
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, slug: true },
      },
      _count: { select: { products: { where: { status: "ACTIVE", deletedAt: null } } } },
    },
  });

  // A parent's count should include everything listed under its subcategories.
  const childCounts = await db.product.groupBy({
    by: ["categoryId"],
    where: { status: "ACTIVE", deletedAt: null },
    _count: { _all: true },
  });
  const countByCategory = new Map(childCounts.map((row) => [row.categoryId, row._count._all]));

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    iconName: category.iconName,
    children: category.children,
    productCount:
      (countByCategory.get(category.id) ?? 0) +
      category.children.reduce((total, child) => total + (countByCategory.get(child.id) ?? 0), 0),
  }));
});

/** Flat list of every active category, for filter dropdowns. */
export const getCategoryTree = cache(
  async (): Promise<Array<{ id: string; name: string; slug: string; parentId: string | null }>> => {
    return db.productCategory.findMany({
      where: { isActive: true },
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
      select: { id: true, name: true, slug: true, parentId: true },
    });
  },
);

export const getCategoryBySlug = cache(async (slug: string) => {
  return db.productCategory.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      iconName: true,
      parentId: true,
      parent: { select: { id: true, name: true, slug: true } },
      children: { select: { id: true, name: true, slug: true }, orderBy: { sortOrder: "asc" } },
    },
  });
});

/**
 * Platform settings, read as a key/value map with defaults applied.
 *
 * Commission and thresholds are configuration, not constants, so an admin can
 * change the commercial model without a deployment. Defaults live in
 * `lib/platform-settings` so the seed and the admin console share them.
 */
export const getPlatformSettings = cache(
  async (): Promise<PlatformSettings> => {
    const rows = await db.platformSetting.findMany({ select: { key: true, value: true } });
    const settings = { ...PLATFORM_SETTING_DEFAULTS } as PlatformSettings;

    for (const row of rows) {
      if (row.key in settings) {
        const value = row.value;
        if (typeof value === "number" || typeof value === "boolean") {
          settings[row.key as PlatformSettingKey] = value;
        }
      }
    }

    return settings;
  },
);

/**
 * Commission rate that applies to a supplier: their own override, otherwise the
 * platform default. Returns 0 when commission is switched off entirely, which is
 * how BuildLink launches.
 */
export async function commissionRateBpsFor(
  supplierCommissionRateBps: number | null,
): Promise<number> {
  const settings = await getPlatformSettings();
  if (settings["commission.enabled"] !== true) return 0;
  return supplierCommissionRateBps ?? Number(settings["commission.default_rate_bps"]);
}
