import "server-only";
import { cache } from "react";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fileUrl } from "@/lib/services/storage";
import { calculateTrustScore, type TrustScoreResult } from "@/lib/domain/trust-score";
import { DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";
import type { ProductSearchParams } from "@/lib/validation/marketplace";
import type { ProductUnit, VerificationStatus } from "@prisma/client";

/**
 * Marketplace reads.
 *
 * Search runs as one raw statement so ranking, distance and pagination all
 * happen in Postgres: the alternative — filtering in the database and sorting in
 * Node — would need the whole result set in memory, which stops working the
 * moment the catalogue is real. Matching uses `ILIKE '%term%'` and `similarity()`
 * against the `pg_trgm` GIN indexes declared on `Product.name`, `Product.brand`
 * and `SupplierProfile.businessName`, which means a search for "cemant" still
 * finds cement.
 *
 * Only `ACTIVE`, non-deleted products from non-suspended suppliers are ever
 * returned. That predicate lives in one place — `visibilityConditions` — because
 * a moderation decision that leaks is worse than a slow query.
 */

export type ProductListItem = {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  unit: ProductUnit;
  priceMinor: number;
  minimumOrderQuantity: number;
  stockQuantity: number;
  deliveryAvailable: boolean;
  isDemo: boolean;
  imageUrl: string | null;
  imageAlt: string | null;
  categoryName: string;
  categorySlug: string;
  supplier: {
    id: string;
    slug: string;
    businessName: string;
    verificationStatus: VerificationStatus;
    trustScore: number;
    ratingAverageBps: number;
    ratingCount: number;
    provinceName: string;
    districtName: string | null;
    isDemo: boolean;
  };
  distanceKm: number | null;
};

export type ProductSearchResult = {
  items: ProductListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** Shared visibility predicate for every catalogue read. */
function visibilityConditions(): Prisma.Sql[] {
  return [
    Prisma.sql`p."deletedAt" IS NULL`,
    Prisma.sql`p."status" = 'ACTIVE'::"ProductStatus"`,
    Prisma.sql`s."deletedAt" IS NULL`,
    Prisma.sql`s."isSuspended" = false`,
    Prisma.sql`s."verificationStatus" <> 'SUSPENDED'::"VerificationStatus"`,
  ];
}

/**
 * Great-circle distance in kilometres between a reference point and a supplier's
 * district (falling back to its province centroid). Approximate by design — the
 * seeded coordinates are district centres, not street addresses.
 */
function distanceExpression(latitude: number, longitude: number): Prisma.Sql {
  return Prisma.sql`(
    6371 * acos(
      least(1, greatest(-1,
        sin(radians(${latitude})) * sin(radians(coalesce(sd."latitude", sp."latitude")))
        + cos(radians(${latitude})) * cos(radians(coalesce(sd."latitude", sp."latitude")))
          * cos(radians(coalesce(sd."longitude", sp."longitude")) - radians(${longitude}))
      ))
    )
  )`;
}

async function referencePoint(
  params: ProductSearchParams,
): Promise<{ latitude: number; longitude: number } | null> {
  if (params.districtId) {
    const district = await db.district.findUnique({
      where: { id: params.districtId },
      select: { latitude: true, longitude: true },
    });
    if (district) return district;
  }
  if (params.provinceId) {
    const province = await db.province.findUnique({
      where: { id: params.provinceId },
      select: { latitude: true, longitude: true },
    });
    if (province) return province;
  }
  return null;
}

export async function searchProducts(
  params: ProductSearchParams,
  options: { pageSize?: number } = {},
): Promise<ProductSearchResult> {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const conditions = visibilityConditions();

  if (params.q) {
    const like = `%${params.q}%`;
    conditions.push(Prisma.sql`(
      p."name" ILIKE ${like}
      OR coalesce(p."brand", '') ILIKE ${like}
      OR s."businessName" ILIKE ${like}
      OR c."name" ILIKE ${like}
      OR similarity(p."name", ${params.q}) > 0.22
      OR similarity(coalesce(p."brand", ''), ${params.q}) > 0.3
    )`);
  }

  if (params.categorySlug) {
    // A top-level category includes everything listed under its children.
    conditions.push(
      Prisma.sql`(c."slug" = ${params.categorySlug} OR parent."slug" = ${params.categorySlug})`,
    );
  }
  if (params.supplierSlug) conditions.push(Prisma.sql`s."slug" = ${params.supplierSlug}`);
  if (params.provinceId) conditions.push(Prisma.sql`s."provinceId" = ${params.provinceId}`);
  if (params.districtId) conditions.push(Prisma.sql`s."districtId" = ${params.districtId}`);
  if (params.minPriceMinor !== null) {
    conditions.push(Prisma.sql`p."priceMinor" >= ${params.minPriceMinor}`);
  }
  if (params.maxPriceMinor !== null) {
    conditions.push(Prisma.sql`p."priceMinor" <= ${params.maxPriceMinor}`);
  }
  if (params.verifiedOnly) {
    conditions.push(Prisma.sql`s."verificationStatus" = 'VERIFIED'::"VerificationStatus"`);
  }
  if (params.inStockOnly) conditions.push(Prisma.sql`p."stockQuantity" > 0`);
  if (params.deliveryOnly) {
    conditions.push(Prisma.sql`(p."deliveryAvailable" = true OR s."deliveryAvailable" = true)`);
  }

  const point = params.sort === "nearest" ? await referencePoint(params) : null;
  const distance = point ? distanceExpression(point.latitude, point.longitude) : null;

  const orderBy = orderByFor(params, distance);

  const rows = await db.$queryRaw<Array<{ id: string; total: bigint; distance_km: number | null }>>(
    Prisma.sql`
      SELECT
        p."id" AS id,
        count(*) OVER () AS total,
        ${distance ?? Prisma.sql`NULL::double precision`} AS distance_km
      FROM "Product" p
      JOIN "SupplierProfile" s ON s."id" = p."supplierId"
      JOIN "ProductCategory" c ON c."id" = p."categoryId"
      LEFT JOIN "ProductCategory" parent ON parent."id" = c."parentId"
      JOIN "Province" sp ON sp."id" = s."provinceId"
      LEFT JOIN "District" sd ON sd."id" = s."districtId"
      WHERE ${Prisma.join(conditions, " AND ")}
      ORDER BY ${orderBy}
      LIMIT ${pageSize} OFFSET ${(params.page - 1) * pageSize}
    `,
  );

  const totalCount = rows[0] ? Number(rows[0].total) : 0;
  const distanceById = new Map(rows.map((row) => [row.id, row.distance_km]));
  const items = await hydrateProducts(
    rows.map((row) => row.id),
    distanceById,
  );

  return {
    items,
    totalCount,
    page: params.page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}

function orderByFor(params: ProductSearchParams, distance: Prisma.Sql | null): Prisma.Sql {
  switch (params.sort) {
    case "price_asc":
      return Prisma.sql`p."priceMinor" ASC, p."name" ASC`;
    case "price_desc":
      return Prisma.sql`p."priceMinor" DESC, p."name" ASC`;
    case "rating":
      return Prisma.sql`s."ratingAverageBps" DESC, s."ratingCount" DESC, s."trustScore" DESC`;
    case "newest":
      return Prisma.sql`p."createdAt" DESC`;
    case "nearest":
      // Without a chosen location there is no "near", so fall back to relevance
      // rather than pretending an arbitrary order is distance.
      return distance
        ? Prisma.sql`${distance} ASC NULLS LAST, p."priceMinor" ASC`
        : defaultOrder(params);
    case "relevance":
    default:
      return defaultOrder(params);
  }
}

function defaultOrder(params: ProductSearchParams): Prisma.Sql {
  if (params.q) {
    return Prisma.sql`
      greatest(
        similarity(p."name", ${params.q}),
        similarity(coalesce(p."brand", ''), ${params.q})
      ) DESC,
      s."trustScore" DESC,
      p."purchaseCount" DESC`;
  }
  return Prisma.sql`s."isPromoted" DESC, s."trustScore" DESC, p."purchaseCount" DESC, p."createdAt" DESC`;
}

/**
 * Fetches the full rows for a page of ids, preserving the order Postgres chose.
 * Two queries beat one enormous join with duplicated image rows.
 */
async function hydrateProducts(
  ids: string[],
  distanceById: Map<string, number | null>,
): Promise<ProductListItem[]> {
  if (ids.length === 0) return [];

  const products = await db.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      slug: true,
      brand: true,
      unit: true,
      priceMinor: true,
      minimumOrderQuantity: true,
      stockQuantity: true,
      deliveryAvailable: true,
      isDemo: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { fileKey: true, altText: true } },
      category: { select: { name: true, slug: true } },
      supplier: {
        select: {
          id: true,
          slug: true,
          businessName: true,
          verificationStatus: true,
          trustScore: true,
          ratingAverageBps: true,
          ratingCount: true,
          isDemo: true,
          province: { select: { name: true } },
          district: { select: { name: true } },
        },
      },
    },
  });

  const byId = new Map(products.map((product) => [product.id, product]));

  return ids.flatMap((id) => {
    const product = byId.get(id);
    if (!product) return [];
    const image = product.images[0];
    return [
      {
        id: product.id,
        name: product.name,
        slug: product.slug,
        brand: product.brand,
        unit: product.unit,
        priceMinor: product.priceMinor,
        minimumOrderQuantity: product.minimumOrderQuantity,
        stockQuantity: product.stockQuantity,
        deliveryAvailable: product.deliveryAvailable,
        isDemo: product.isDemo,
        imageUrl: fileUrl(image?.fileKey),
        imageAlt: image?.altText ?? null,
        categoryName: product.category.name,
        categorySlug: product.category.slug,
        supplier: {
          id: product.supplier.id,
          slug: product.supplier.slug,
          businessName: product.supplier.businessName,
          verificationStatus: product.supplier.verificationStatus,
          trustScore: product.supplier.trustScore,
          ratingAverageBps: product.supplier.ratingAverageBps,
          ratingCount: product.supplier.ratingCount,
          provinceName: product.supplier.province.name,
          districtName: product.supplier.district?.name ?? null,
          isDemo: product.supplier.isDemo,
        },
        distanceKm: distanceById.get(id) ?? null,
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Product detail
// ---------------------------------------------------------------------------

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProduct>>>;

export async function getProduct(productId: string) {
  const product = await db.product.findFirst({
    where: {
      id: productId,
      deletedAt: null,
      status: "ACTIVE",
      supplier: { deletedAt: null, isSuspended: false },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      brand: true,
      unit: true,
      priceMinor: true,
      minimumOrderQuantity: true,
      stockQuantity: true,
      lowStockThreshold: true,
      deliveryAvailable: true,
      isDemo: true,
      viewCount: true,
      purchaseCount: true,
      createdAt: true,
      images: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, fileKey: true, altText: true },
      },
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          parent: { select: { name: true, slug: true } },
        },
      },
      supplier: {
        select: {
          id: true,
          slug: true,
          businessName: true,
          description: true,
          logoKey: true,
          phone: true,
          verificationStatus: true,
          verifiedAt: true,
          trustScore: true,
          ratingAverageBps: true,
          ratingCount: true,
          completedOrders: true,
          deliveryAvailable: true,
          deliveryNotes: true,
          minimumOrderMinor: true,
          deliveryBaseFeeMinor: true,
          deliveryFreeAboveMinor: true,
          yearsOperating: true,
          isDemo: true,
          province: { select: { name: true } },
          district: { select: { name: true } },
        },
      },
    },
  });

  if (!product) return null;

  return {
    ...product,
    images: product.images.map((image) => ({
      id: image.id,
      url: fileUrl(image.fileKey),
      altText: image.altText,
    })),
    supplierLogoUrl: fileUrl(product.supplier.logoKey),
  };
}

/** Same category, different supplier — the comparison a buyer actually wants. */
export async function listAlternatives(
  productId: string,
  categoryId: string,
  limit = 4,
): Promise<ProductListItem[]> {
  const rows = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT p."id" AS id
    FROM "Product" p
    JOIN "SupplierProfile" s ON s."id" = p."supplierId"
    WHERE ${Prisma.join(
      [
        ...visibilityConditions(),
        Prisma.sql`p."categoryId" = ${categoryId}`,
        Prisma.sql`p."id" <> ${productId}`,
      ],
      " AND ",
    )}
    ORDER BY s."trustScore" DESC, p."priceMinor" ASC
    LIMIT ${limit}
  `);

  return hydrateProducts(
    rows.map((row) => row.id),
    new Map(),
  );
}

/** Products chosen for the side-by-side comparison view. */
export async function listProductsForComparison(ids: string[]): Promise<ProductListItem[]> {
  if (ids.length === 0) return [];

  const rows = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT p."id" AS id
    FROM "Product" p
    JOIN "SupplierProfile" s ON s."id" = p."supplierId"
    WHERE ${Prisma.join(
      // Prisma stores UUID primary keys in `text` columns, so the array has to
      // be cast to text[] — `uuid[]` has no equality operator against text.
      [...visibilityConditions(), Prisma.sql`p."id" = ANY(${ids}::text[])`],
      " AND ",
    )}
    ORDER BY p."priceMinor" ASC
  `);

  return hydrateProducts(
    rows.map((row) => row.id),
    new Map(),
  );
}

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

export type SupplierListItem = {
  id: string;
  slug: string;
  businessName: string;
  description: string | null;
  logoUrl: string | null;
  verificationStatus: VerificationStatus;
  trustScore: number;
  ratingAverageBps: number;
  ratingCount: number;
  completedOrders: number;
  provinceName: string;
  districtName: string | null;
  productCount: number;
  categoryNames: string[];
  deliveryAvailable: boolean;
  isDemo: boolean;
};

export async function listSuppliers(options: {
  q?: string | null;
  provinceId?: string | null;
  categorySlug?: string | null;
  verifiedOnly?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<{ items: SupplierListItem[]; totalCount: number; totalPages: number; page: number; pageSize: number }> {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;

  const where: Prisma.SupplierProfileWhereInput = {
    deletedAt: null,
    isSuspended: false,
    verificationStatus: options.verifiedOnly
      ? "VERIFIED"
      : { not: "SUSPENDED" },
    ...(options.provinceId ? { provinceId: options.provinceId } : {}),
    ...(options.categorySlug
      ? {
          OR: [
            { categories: { some: { slug: options.categorySlug } } },
            { products: { some: { category: { slug: options.categorySlug } } } },
          ],
        }
      : {}),
    ...(options.q
      ? {
          businessName: { contains: options.q, mode: "insensitive" },
        }
      : {}),
  };

  const [suppliers, totalCount] = await Promise.all([
    db.supplierProfile.findMany({
      where,
      orderBy: [
        { isPromoted: "desc" },
        { trustScore: "desc" },
        { ratingAverageBps: "desc" },
        { businessName: "asc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        businessName: true,
        description: true,
        logoKey: true,
        verificationStatus: true,
        trustScore: true,
        ratingAverageBps: true,
        ratingCount: true,
        completedOrders: true,
        deliveryAvailable: true,
        isDemo: true,
        province: { select: { name: true } },
        district: { select: { name: true } },
        categories: { select: { name: true }, take: 4 },
        _count: { select: { products: { where: { status: "ACTIVE", deletedAt: null } } } },
      },
    }),
    db.supplierProfile.count({ where }),
  ]);

  return {
    items: suppliers.map((supplier) => ({
      id: supplier.id,
      slug: supplier.slug,
      businessName: supplier.businessName,
      description: supplier.description,
      logoUrl: fileUrl(supplier.logoKey),
      verificationStatus: supplier.verificationStatus,
      trustScore: supplier.trustScore,
      ratingAverageBps: supplier.ratingAverageBps,
      ratingCount: supplier.ratingCount,
      completedOrders: supplier.completedOrders,
      provinceName: supplier.province.name,
      districtName: supplier.district?.name ?? null,
      productCount: supplier._count.products,
      categoryNames: supplier.categories.map((category) => category.name),
      deliveryAvailable: supplier.deliveryAvailable,
      isDemo: supplier.isDemo,
    })),
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    page,
    pageSize,
  };
}

export type SupplierProfileView = NonNullable<Awaited<ReturnType<typeof getSupplierBySlug>>>;

export async function getSupplierBySlug(slug: string) {
  const supplier = await db.supplierProfile.findFirst({
    where: { slug, deletedAt: null },
    select: {
      id: true,
      slug: true,
      businessName: true,
      description: true,
      logoKey: true,
      phone: true,
      email: true,
      address: true,
      verificationStatus: true,
      verifiedAt: true,
      businessRegistrationStatus: true,
      yearsOperating: true,
      trustScore: true,
      ratingAverageBps: true,
      ratingCount: true,
      completedOrders: true,
      cancelledOrders: true,
      totalOrders: true,
      averageResponseMinutes: true,
      deliveryAvailable: true,
      deliveryNotes: true,
      minimumOrderMinor: true,
      deliveryBaseFeeMinor: true,
      deliveryFreeAboveMinor: true,
      isSuspended: true,
      suspendedReason: true,
      isDemo: true,
      createdAt: true,
      province: { select: { id: true, name: true } },
      district: { select: { id: true, name: true } },
      categories: { select: { id: true, name: true, slug: true } },
      _count: { select: { products: { where: { status: "ACTIVE", deletedAt: null } } } },
    },
  });

  if (!supplier) return null;

  const [deliveriesCompleted, deliveriesAttempted, openDisputes, resolvedDisputes] =
    await Promise.all([
      db.delivery.count({
        where: { order: { supplierId: supplier.id }, status: "DELIVERED" },
      }),
      db.delivery.count({
        where: { order: { supplierId: supplier.id }, status: { in: ["DELIVERED", "FAILED"] } },
      }),
      db.dispute.count({
        where: { supplierId: supplier.id, status: { in: ["OPEN", "UNDER_REVIEW"] } },
      }),
      db.dispute.count({
        where: { supplierId: supplier.id, status: { in: ["RESOLVED", "CLOSED"] } },
      }),
    ]);

  const trust: TrustScoreResult = calculateTrustScore({
    verificationStatus: supplier.verificationStatus,
    ratingAverageBps: supplier.ratingAverageBps,
    ratingCount: supplier.ratingCount,
    completedOrders: supplier.completedOrders,
    cancelledOrders: supplier.cancelledOrders,
    totalOrders: supplier.totalOrders,
    deliveriesCompleted,
    deliveriesAttempted,
    openDisputes,
    resolvedDisputes,
    averageResponseMinutes: supplier.averageResponseMinutes,
  });

  return {
    ...supplier,
    logoUrl: fileUrl(supplier.logoKey),
    productCount: supplier._count.products,
    trust,
  };
}

export type SupplierReview = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  customerName: string;
  orderNumber: string;
  productQualityRating: number | null;
  deliveryRating: number | null;
  communicationRating: number | null;
};

export async function listSupplierReviews(
  supplierId: string,
  limit = 10,
): Promise<SupplierReview[]> {
  const reviews = await db.review.findMany({
    where: { supplierId, status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      productQualityRating: true,
      deliveryRating: true,
      communicationRating: true,
      customer: { select: { name: true } },
      order: { select: { orderNumber: true } },
    },
  });

  return reviews.map((review) => ({
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    // Reviews show a first name only: enough to read as a real person without
    // publishing a customer's full identity beside their spending.
    customerName: review.customer.name.split(" ")[0] ?? "Customer",
    orderNumber: review.order.orderNumber,
    productQualityRating: review.productQualityRating,
    deliveryRating: review.deliveryRating,
    communicationRating: review.communicationRating,
  }));
}

/** Price band per category, used to label a product as competitively priced. */
export const getCategoryPriceBands = cache(
  async (): Promise<Map<string, { minMinor: number; averageMinor: number }>> => {
    const rows = await db.$queryRaw<
      Array<{ category_id: string; min_minor: number; avg_minor: number }>
    >(Prisma.sql`
      SELECT
        p."categoryId" AS category_id,
        min(p."priceMinor") AS min_minor,
        avg(p."priceMinor") AS avg_minor
      FROM "Product" p
      JOIN "SupplierProfile" s ON s."id" = p."supplierId"
      WHERE ${Prisma.join(visibilityConditions(), " AND ")}
      GROUP BY p."categoryId"
    `);

    return new Map(
      rows.map((row) => [
        row.category_id,
        { minMinor: Number(row.min_minor), averageMinor: Math.round(Number(row.avg_minor)) },
      ]),
    );
  },
);

/** Headline counts for the marketplace landing strip. */
export const getMarketplaceStats = cache(
  async (): Promise<{ products: number; suppliers: number; verifiedSuppliers: number; districts: number }> => {
    const [products, suppliers, verifiedSuppliers, districts] = await Promise.all([
      db.product.count({
        where: { status: "ACTIVE", deletedAt: null, supplier: { isSuspended: false } },
      }),
      db.supplierProfile.count({ where: { deletedAt: null, isSuspended: false } }),
      db.supplierProfile.count({
        where: { deletedAt: null, isSuspended: false, verificationStatus: "VERIFIED" },
      }),
      db.supplierProfile
        .findMany({
          where: { deletedAt: null, isSuspended: false },
          select: { districtId: true },
          distinct: ["districtId"],
        })
        .then((rows) => rows.filter((row) => row.districtId !== null).length),
    ]);

    return { products, suppliers, verifiedSuppliers, districts };
  },
);
