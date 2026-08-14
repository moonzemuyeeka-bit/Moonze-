import { PrismaClient } from "@prisma/client";
import { seedCategories, seedPlatformSettings, seedProvinces } from "./seed/reference";
import { DEMO_PASSWORD, seedDemoData } from "./seed/demo";

/**
 * Database seed.
 *
 * Two layers, both idempotent:
 *  * **Reference data** — Zambian provinces and districts, the marketplace
 *    category tree and platform settings. Always seeded; production needs it.
 *  * **Demonstration data** — accounts, supplier catalogues and trading history,
 *    every row flagged `isDemo` and named `[DEMO]`. Skipped when
 *    `SEED_DEMO_DATA=false`, which is how a real deployment is seeded.
 *
 * Re-running never deletes anything, so it is safe against a database that
 * already has real users.
 */

const db = new PrismaClient();

async function main(): Promise<void> {
  const includeDemo = process.env.SEED_DEMO_DATA !== "false";

  console.log("→ Seeding Zambian provinces and districts…");
  await seedProvinces(db);

  console.log("→ Seeding marketplace categories…");
  await seedCategories(db);

  console.log("→ Seeding platform settings…");
  await seedPlatformSettings(db);

  if (includeDemo) {
    console.log("→ Seeding demonstration accounts, catalogues and orders…");
    await seedDemoData(db);
  } else {
    console.log("→ Skipping demonstration data (SEED_DEMO_DATA=false).");
  }

  const [provinces, districts, categories, suppliers, products, orders] = await Promise.all([
    db.province.count(),
    db.district.count(),
    db.productCategory.count(),
    db.supplierProfile.count(),
    db.product.count(),
    db.order.count(),
  ]);

  console.log("\nSeed complete.");
  console.log(
    `  ${provinces} provinces · ${districts} districts · ${categories} categories · ` +
      `${suppliers} suppliers · ${products} products · ${orders} orders`,
  );

  if (includeDemo) {
    console.log(`\nDemo sign-in (all accounts use the password ${DEMO_PASSWORD}):`);
    console.log("  Customer (mid-build)      customer@buildlink.zm");
    console.log("  Customer (renovation)     renovator@buildlink.zm");
    console.log("  Supplier (cement/sand)    sales@demo-zambezicement.zm");
    console.log("  Supplier (roofing/steel)  quotes@demo-greatnorthroofing.zm");
    console.log("  Delivery provider         dispatch@demo-lusakasitelogistics.zm");
    console.log("  Administrator             admin@buildlink.zm");
    console.log("  Super administrator       superadmin@buildlink.zm");
  }
}

main()
  .catch((error) => {
    console.error("\nSeed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
