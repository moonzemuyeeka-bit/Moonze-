import "server-only";
import { db } from "@/lib/db";
import { summariseCart, type CartLineInput, type CartSummary, type FulfilmentSelection } from "@/lib/domain/cart";
import { fileUrl } from "@/lib/services/storage";

/**
 * Cart reads.
 *
 * Prices are re-read from the product on every load rather than snapshotted into
 * the cart row: a customer must never be shown yesterday's price and charged
 * today's. Snapshots happen at checkout, where they belong.
 */

export type CartView = {
  cartId: string | null;
  projectId: string | null;
  projectName: string | null;
  summary: CartSummary;
  lines: CartLineInput[];
};

const EMPTY_SUMMARY: CartSummary = {
  groups: [],
  itemCount: 0,
  lineCount: 0,
  supplierCount: 0,
  subtotalMinor: 0,
  deliveryFeeMinor: 0,
  totalMinor: 0,
  isCheckoutable: false,
  blockingIssueCount: 0,
};

export async function getCart(
  userId: string,
  fulfilment: FulfilmentSelection = {},
): Promise<CartView> {
  const cart = await db.cart.findFirst({
    where: { userId, checkedOutAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      projectId: true,
      project: { select: { name: true } },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          quantity: true,
          product: {
            select: {
              id: true,
              name: true,
              brand: true,
              unit: true,
              priceMinor: true,
              minimumOrderQuantity: true,
              stockQuantity: true,
              status: true,
              deletedAt: true,
              images: { orderBy: { sortOrder: "asc" }, take: 1, select: { fileKey: true } },
              supplier: {
                select: {
                  id: true,
                  businessName: true,
                  slug: true,
                  verificationStatus: true,
                  isDemo: true,
                  isSuspended: true,
                  deletedAt: true,
                  deliveryAvailable: true,
                  minimumOrderMinor: true,
                  deliveryBaseFeeMinor: true,
                  deliveryFreeAboveMinor: true,
                  province: { select: { name: true } },
                  district: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!cart) {
    return {
      cartId: null,
      projectId: null,
      projectName: null,
      summary: EMPTY_SUMMARY,
      lines: [],
    };
  }

  const lines: CartLineInput[] = cart.items.map((item) => ({
    itemId: item.id,
    productId: item.product.id,
    productName: item.product.name,
    brand: item.product.brand,
    unit: item.product.unit,
    unitPriceMinor: item.product.priceMinor,
    quantity: item.quantity,
    minimumOrderQuantity: item.product.minimumOrderQuantity,
    stockQuantity: item.product.stockQuantity,
    isAvailable:
      item.product.status === "ACTIVE" &&
      item.product.deletedAt === null &&
      item.product.supplier.deletedAt === null &&
      item.product.supplier.isSuspended === false,
    imageKey: item.product.images[0]?.fileKey ?? null,
    supplier: {
      id: item.product.supplier.id,
      businessName: item.product.supplier.businessName,
      slug: item.product.supplier.slug,
      verificationStatus: item.product.supplier.verificationStatus,
      isDemo: item.product.supplier.isDemo,
      deliveryAvailable: item.product.supplier.deliveryAvailable,
      minimumOrderMinor: item.product.supplier.minimumOrderMinor,
      deliveryBaseFeeMinor: item.product.supplier.deliveryBaseFeeMinor,
      deliveryFreeAboveMinor: item.product.supplier.deliveryFreeAboveMinor,
      provinceName: item.product.supplier.province.name,
      districtName: item.product.supplier.district?.name ?? null,
    },
  }));

  return {
    cartId: cart.id,
    projectId: cart.projectId,
    projectName: cart.project?.name ?? null,
    summary: summariseCart(lines, fulfilment),
    lines,
  };
}

export function cartLineImageUrl(imageKey: string | null): string | null {
  return fileUrl(imageKey);
}

/** Quantity of one product already in the cart, so the product page can say so. */
export async function cartQuantityFor(userId: string, productId: string): Promise<number> {
  const item = await db.cartItem.findFirst({
    where: { productId, cart: { userId, checkedOutAt: null } },
    select: { quantity: true },
  });
  return item?.quantity ?? 0;
}
