import type { PrismaClient } from "@prisma/client";
import { ZAMBIAN_PROVINCES } from "../../src/lib/zambia";
import { PRODUCT_CATEGORIES } from "../../src/lib/catalogue";
import { PLATFORM_SETTING_DEFAULTS } from "../../src/lib/platform-settings";

/**
 * Reference data.
 *
 * Everything here is upserted and nothing is deleted, so re-running the seed on
 * a live database is safe: it fills gaps and refreshes labels without touching
 * the suppliers, orders or payments that reference these rows.
 */

export async function seedProvinces(db: PrismaClient): Promise<void> {
  for (const province of ZAMBIAN_PROVINCES) {
    const record = await db.province.upsert({
      where: { code: province.code },
      update: {
        name: province.name,
        latitude: province.latitude,
        longitude: province.longitude,
      },
      create: {
        name: province.name,
        code: province.code,
        latitude: province.latitude,
        longitude: province.longitude,
      },
      select: { id: true },
    });

    for (const district of province.districts) {
      await db.district.upsert({
        where: { provinceId_name: { provinceId: record.id, name: district.name } },
        update: { latitude: district.latitude, longitude: district.longitude },
        create: {
          provinceId: record.id,
          name: district.name,
          latitude: district.latitude,
          longitude: district.longitude,
        },
      });
    }
  }
}

export async function seedCategories(db: PrismaClient): Promise<void> {
  for (const [index, category] of PRODUCT_CATEGORIES.entries()) {
    const parent = await db.productCategory.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
        iconName: category.iconName,
        sortOrder: index,
        isActive: true,
      },
      create: {
        slug: category.slug,
        name: category.name,
        description: category.description,
        iconName: category.iconName,
        sortOrder: index,
      },
      select: { id: true },
    });

    for (const [childIndex, child] of category.subcategories.entries()) {
      await db.productCategory.upsert({
        where: { slug: child.slug },
        update: {
          name: child.name,
          parentId: parent.id,
          iconName: category.iconName,
          sortOrder: childIndex,
          isActive: true,
        },
        create: {
          slug: child.slug,
          name: child.name,
          parentId: parent.id,
          iconName: category.iconName,
          sortOrder: childIndex,
        },
      });
    }
  }
}

const SETTING_DESCRIPTIONS: Record<string, string> = {
  "commission.default_rate_bps":
    "Default commission charged on the goods value of an order, in basis points (350 = 3.5%).",
  "commission.enabled":
    "When false, no commission is charged or displayed. BuildLink launches with commission switched off.",
  "subscription.standard_price_minor": "Monthly price of the Standard supplier subscription, in ngwee.",
  "subscription.premium_price_minor": "Monthly price of the Premium supplier subscription, in ngwee.",
  "budget.alert_threshold_percent":
    "Share of a budget category that must be spent before the customer is warned.",
  "orders.auto_complete_after_days":
    "Days after delivery before an order is treated as complete for reporting.",
};

/** Existing values are preserved — an admin's change must survive a re-seed. */
export async function seedPlatformSettings(db: PrismaClient): Promise<void> {
  for (const [key, value] of Object.entries(PLATFORM_SETTING_DEFAULTS)) {
    await db.platformSetting.upsert({
      where: { key },
      update: { description: SETTING_DESCRIPTIONS[key] ?? key },
      create: { key, value, description: SETTING_DESCRIPTIONS[key] ?? key },
    });
  }
}
