import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  decideDisputeAction,
  decideDocumentAction,
  decideVerificationAction,
  moderateProductAction,
  moderateReviewAction,
  savePlatformSettingsAction,
  setSupplierCommercialsAction,
  setSupplierSuspensionAction,
  setUserRoleAction,
  setUserStatusAction,
} from "@/server/admin/actions";
import { raiseDisputeAction } from "@/server/disputes/actions";
import { getPlatformSettings } from "@/server/reference/queries";
import {
  getAdminDashboard,
  getDisputeForAdmin,
  getPlatformAnalytics,
  listAuditLog,
  listDisputes,
  listProductsForAdmin,
  listReviewsForAdmin,
  listSuppliersForAdmin,
  listUsers,
} from "@/server/admin/queries";
import { createProduct, createOrder, createSupplier, createUser, signIn } from "./helpers/factories";

/**
 * The administration console, end to end against a real database.
 *
 * These tests are about authority, not layout: who may take each decision, what
 * the person on the receiving end is told, and whether the audit row that makes
 * the decision explainable afterwards actually gets written. Every case drives
 * the same server actions the console does.
 */

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

async function createAdmin(role: "ADMIN" | "SUPER_ADMIN" = "SUPER_ADMIN") {
  return createUser({ role, name: role === "SUPER_ADMIN" ? "Namakau Sitali" : "Joseph Phiri" });
}

async function pendingDocument(supplierId: string) {
  return db.supplierDocument.create({
    data: {
      supplierId,
      type: "BUSINESS_REGISTRATION_CERTIFICATE",
      fileKey: "suppliers/test/pacra.pdf",
      fileName: "pacra.pdf",
      mimeType: "application/pdf",
      sizeBytes: 24_000,
    },
  });
}

describe("account administration", () => {
  it("suspends a supplier's account, stops their trading and signs them out", async () => {
    const admin = await createAdmin();
    const { supplier, user: supplierUser } = await createSupplier();
    await signIn(supplierUser.id);
    const sessionsBefore = await db.session.count({ where: { userId: supplierUser.id } });
    expect(sessionsBefore).toBe(1);

    await signIn(admin.id);
    const result = await setUserStatusAction(
      null,
      form({
        userId: supplierUser.id,
        status: "SUSPENDED",
        reason: "Four disputes in a month for materials paid for and never delivered.",
      }),
    );

    expect(result?.ok).toBe(true);

    const updated = await db.user.findUniqueOrThrow({ where: { id: supplierUser.id } });
    expect(updated.status).toBe("SUSPENDED");

    // Trading must stop with the account, or customers keep ordering from a
    // business BuildLink has just stopped.
    const profile = await db.supplierProfile.findUniqueOrThrow({ where: { id: supplier.id } });
    expect(profile.isSuspended).toBe(true);
    expect(profile.suspendedReason).toContain("Four disputes");

    // A live session would make the suspension advisory rather than real.
    expect(await db.session.count({ where: { userId: supplierUser.id } })).toBe(0);

    const notification = await db.notification.findFirst({ where: { userId: supplierUser.id } });
    expect(notification?.body).toContain("Four disputes");

    const audit = await db.auditLog.findFirst({
      where: { resourceType: "user", resourceId: supplierUser.id },
    });
    expect(audit?.action).toBe("user.suspended");
    expect(audit?.actorUserId).toBe(admin.id);
  });

  it("refuses to let an administrator suspend their own account", async () => {
    const admin = await createAdmin();
    await signIn(admin.id);

    const result = await setUserStatusAction(
      null,
      form({ userId: admin.id, status: "SUSPENDED", reason: "Testing the guard." }),
    );

    expect(result?.ok).toBe(false);
    expect(await db.user.findUniqueOrThrow({ where: { id: admin.id } })).toMatchObject({
      status: "ACTIVE",
    });
  });

  it("refuses to let an ordinary administrator suspend another administrator", async () => {
    const admin = await createAdmin("ADMIN");
    const colleague = await createAdmin("ADMIN");
    await signIn(admin.id);

    const result = await setUserStatusAction(
      null,
      form({ userId: colleague.id, status: "SUSPENDED", reason: "Should not be permitted." }),
    );

    expect(result?.ok).toBe(false);
    expect(await db.user.findUniqueOrThrow({ where: { id: colleague.id } })).toMatchObject({
      status: "ACTIVE",
    });
  });

  it("demands a reason before taking an account away", async () => {
    const admin = await createAdmin();
    const customer = await createUser();
    await signIn(admin.id);

    const result = await setUserStatusAction(
      null,
      form({ userId: customer.id, status: "SUSPENDED", reason: "" }),
    );

    expect(result?.ok).toBe(false);
    if (result?.ok === false) expect(result.fieldErrors?.reason).toBeDefined();
  });

  it("only lets a super administrator change a role, and only to one with a profile behind it", async () => {
    const admin = await createAdmin("ADMIN");
    const superAdmin = await createAdmin("SUPER_ADMIN");
    const customer = await createUser();

    await signIn(admin.id);
    const denied = await setUserRoleAction(
      null,
      form({ userId: customer.id, role: "SUPPLIER", reason: "Registered a business by phone." }),
    );
    expect(denied?.ok).toBe(false);

    await signIn(superAdmin.id);
    const withoutProfile = await setUserRoleAction(
      null,
      form({ userId: customer.id, role: "SUPPLIER", reason: "Registered a business by phone." }),
    );
    expect(withoutProfile?.ok).toBe(false);

    const promoted = await setUserRoleAction(
      null,
      form({ userId: customer.id, role: "PROFESSIONAL", reason: "Verified as a site engineer." }),
    );
    expect(promoted?.ok).toBe(true);
    expect(await db.user.findUniqueOrThrow({ where: { id: customer.id } })).toMatchObject({
      role: "PROFESSIONAL",
    });
  });
});

describe("supplier verification", () => {
  it("will not grant verification before a document has been accepted", async () => {
    const admin = await createAdmin();
    const { supplier } = await createSupplier({ verificationStatus: "PENDING" });
    await pendingDocument(supplier.id);
    await signIn(admin.id);

    const premature = await decideVerificationAction(
      null,
      form({ supplierId: supplier.id, decision: "VERIFIED", note: "" }),
    );

    expect(premature?.ok).toBe(false);
    expect(await db.supplierProfile.findUniqueOrThrow({ where: { id: supplier.id } })).toMatchObject(
      { verificationStatus: "PENDING", verifiedAt: null },
    );
  });

  it("accepts a document, then verifies the business and tells the owner", async () => {
    const admin = await createAdmin();
    const { supplier, user: supplierUser } = await createSupplier({
      verificationStatus: "PENDING",
    });
    const document = await pendingDocument(supplier.id);
    await signIn(admin.id);

    const accepted = await decideDocumentAction(
      null,
      form({ documentId: document.id, decision: "APPROVED", note: "" }),
    );
    expect(accepted?.ok).toBe(true);
    expect(await db.supplierDocument.findUniqueOrThrow({ where: { id: document.id } })).toMatchObject(
      { reviewStatus: "APPROVED", reviewedById: admin.id },
    );

    const verified = await decideVerificationAction(
      null,
      form({
        supplierId: supplier.id,
        decision: "VERIFIED",
        note: "PACRA certificate matches the trading name.",
      }),
    );
    expect(verified?.ok).toBe(true);

    const profile = await db.supplierProfile.findUniqueOrThrow({ where: { id: supplier.id } });
    expect(profile.verificationStatus).toBe("VERIFIED");
    expect(profile.verifiedAt).not.toBeNull();
    expect(profile.businessRegistrationStatus).toBe("VERIFIED");

    // The decision is kept as a reviewable record, not just a status flag.
    const review = await db.supplierVerification.findFirstOrThrow({
      where: { supplierId: supplier.id },
    });
    expect(review.status).toBe("VERIFIED");
    expect(review.reviewedById).toBe(admin.id);

    const notification = await db.notification.findFirst({
      where: { userId: supplierUser.id, title: { contains: "verified" } },
    });
    expect(notification?.linkUrl).toBe("/supplier/verification");
  });

  it("rejecting a document requires a reason the supplier can act on", async () => {
    const admin = await createAdmin();
    const { supplier, user: supplierUser } = await createSupplier();
    const document = await pendingDocument(supplier.id);
    await signIn(admin.id);

    const blank = await decideDocumentAction(
      null,
      form({ documentId: document.id, decision: "REJECTED", note: "" }),
    );
    expect(blank?.ok).toBe(false);

    const rejected = await decideDocumentAction(
      null,
      form({
        documentId: document.id,
        decision: "REJECTED",
        note: "The certificate is cut off and the registration number cannot be read.",
      }),
    );
    expect(rejected?.ok).toBe(true);

    const notification = await db.notification.findFirst({ where: { userId: supplierUser.id } });
    expect(notification?.body).toContain("cannot be read");
  });

  it("suspending a business hides its catalogue and restoring puts it back in the queue", async () => {
    const admin = await createAdmin();
    const { supplier } = await createSupplier();
    await signIn(admin.id);

    const suspended = await setSupplierSuspensionAction(
      null,
      form({
        supplierId: supplier.id,
        suspend: "true",
        reason: "Selling cement at a price it cannot honour.",
      }),
    );
    expect(suspended?.ok).toBe(true);
    expect(await db.supplierProfile.findUniqueOrThrow({ where: { id: supplier.id } })).toMatchObject(
      { isSuspended: true, verificationStatus: "SUSPENDED" },
    );

    const restored = await setSupplierSuspensionAction(
      null,
      form({ supplierId: supplier.id, suspend: "false", reason: "" }),
    );
    expect(restored?.ok).toBe(true);
    expect(await db.supplierProfile.findUniqueOrThrow({ where: { id: supplier.id } })).toMatchObject(
      { isSuspended: false, suspendedReason: null, verificationStatus: "PENDING" },
    );
  });

  it("records a commission override against one business, leaving the default alone", async () => {
    const admin = await createAdmin();
    const { supplier } = await createSupplier();
    await signIn(admin.id);

    const result = await setSupplierCommercialsAction(
      null,
      form({ supplierId: supplier.id, subscriptionTier: "PREMIUM", commissionRateBps: "275" }),
    );

    expect(result?.ok).toBe(true);
    expect(await db.supplierProfile.findUniqueOrThrow({ where: { id: supplier.id } })).toMatchObject(
      { subscriptionTier: "PREMIUM", commissionRateBps: 275 },
    );

    // Blank means "fall back to the platform default", not zero.
    const cleared = await setSupplierCommercialsAction(
      null,
      form({ supplierId: supplier.id, subscriptionTier: "FREE", commissionRateBps: "" }),
    );
    expect(cleared?.ok).toBe(true);
    expect(await db.supplierProfile.findUniqueOrThrow({ where: { id: supplier.id } })).toMatchObject(
      { commissionRateBps: null },
    );
  });
});

describe("product moderation", () => {
  it("publishes an approved listing and tells the supplier", async () => {
    const admin = await createAdmin();
    const { supplier, user: supplierUser } = await createSupplier();
    const product = await createProduct(supplier.id, { status: "PENDING_APPROVAL" });
    await signIn(admin.id);

    const result = await moderateProductAction(
      null,
      form({ productId: product.id, decision: "APPROVE", reason: "" }),
    );

    expect(result?.ok).toBe(true);
    expect(await db.product.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({
      status: "ACTIVE",
      rejectionReason: null,
    });

    const notification = await db.notification.findFirst({ where: { userId: supplierUser.id } });
    expect(notification?.title).toContain("live");
  });

  it("rejects a listing with the change the supplier has to make", async () => {
    const admin = await createAdmin();
    const { supplier } = await createSupplier();
    const product = await createProduct(supplier.id, { status: "PENDING_APPROVAL" });
    await signIn(admin.id);

    const blank = await moderateProductAction(
      null,
      form({ productId: product.id, decision: "REJECT", reason: "" }),
    );
    expect(blank?.ok).toBe(false);

    const rejected = await moderateProductAction(
      null,
      form({
        productId: product.id,
        decision: "REJECT",
        reason: "The price is a placeholder — put the real price per bag.",
      }),
    );
    expect(rejected?.ok).toBe(true);
    expect(await db.product.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({
      status: "REJECTED",
    });
  });
});

describe("disputes", () => {
  async function disputableOrder() {
    const customer = await createUser({ name: "Bwalya Chileshe" });
    const { supplier, user: supplierUser } = await createSupplier();
    const order = await createOrder({
      customerId: customer.id,
      supplierId: supplier.id,
      status: "OUT_FOR_DELIVERY",
    });
    return { customer, supplier, supplierUser, order };
  }

  it("lets the customer escalate an order, marks it disputed and queues it for BuildLink", async () => {
    const admin = await createAdmin();
    const { customer, order, supplierUser } = await disputableOrder();
    await signIn(customer.id);

    const result = await raiseDisputeAction(
      null,
      form({
        orderId: order.id,
        reason: "QUANTITY_SHORTFALL",
        description:
          "I ordered 200 blocks. 160 arrived on 6 August and the driver said the rest would follow. Nothing since.",
      }),
    );

    expect(result?.ok).toBe(true);

    const dispute = await db.dispute.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(dispute.status).toBe("OPEN");
    expect(dispute.raisedById).toBe(customer.id);

    // The order has to show as disputed, or the supplier's console keeps
    // presenting it as a delivery in progress.
    expect(await db.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      status: "DISPUTED",
    });

    // The counterparty and every administrator are told.
    const supplierNotice = await db.notification.findFirst({
      where: { userId: supplierUser.id, type: "DISPUTE_UPDATE" },
    });
    expect(supplierNotice).not.toBeNull();
    const adminNotice = await db.notification.findFirst({
      where: { userId: admin.id, type: "DISPUTE_UPDATE" },
    });
    expect(adminNotice?.linkUrl).toBe(`/admin/disputes/${dispute.id}`);
  });

  it("refuses a second dispute on the same order", async () => {
    const { customer, order } = await disputableOrder();
    await signIn(customer.id);

    const fields = {
      orderId: order.id,
      reason: "LATE_DELIVERY",
      description: "The delivery was promised for Tuesday and has still not arrived on Friday.",
    };
    expect((await raiseDisputeAction(null, form(fields)))?.ok).toBe(true);
    expect((await raiseDisputeAction(null, form(fields)))?.ok).toBe(false);
    expect(await db.dispute.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("refuses a dispute from somebody who is not a party to the order", async () => {
    const { order } = await disputableOrder();
    const stranger = await createUser({ name: "Mutale Nkonde" });
    await signIn(stranger.id);

    const result = await raiseDisputeAction(
      null,
      form({
        orderId: order.id,
        reason: "OTHER",
        description: "This is not my order and I should not be able to dispute it.",
      }),
    );

    expect(result?.ok).toBe(false);
    expect(await db.dispute.count({ where: { orderId: order.id } })).toBe(0);
  });

  it("will not accept a dispute on an order the customer could simply cancel", async () => {
    const customer = await createUser();
    const { supplier } = await createSupplier();
    const order = await createOrder({
      customerId: customer.id,
      supplierId: supplier.id,
      status: "PENDING_PAYMENT",
    });
    await signIn(customer.id);

    const result = await raiseDisputeAction(
      null,
      form({
        orderId: order.id,
        reason: "OTHER",
        description: "Nothing has happened yet, so there is nothing to arbitrate here.",
      }),
    );

    expect(result?.ok).toBe(false);
  });

  it("resolves a dispute with a decision both parties are shown", async () => {
    const admin = await createAdmin();
    const { customer, order, supplierUser } = await disputableOrder();

    await signIn(customer.id);
    await raiseDisputeAction(
      null,
      form({
        orderId: order.id,
        reason: "QUANTITY_SHORTFALL",
        description: "40 of the 200 blocks I paid for have never arrived.",
      }),
    );
    const dispute = await db.dispute.findUniqueOrThrow({ where: { orderId: order.id } });

    await signIn(admin.id);
    const acknowledged = await decideDisputeAction(
      null,
      form({ disputeId: dispute.id, status: "UNDER_REVIEW", resolution: "" }),
    );
    expect(acknowledged?.ok).toBe(true);
    expect(await db.dispute.findUniqueOrThrow({ where: { id: dispute.id } })).toMatchObject({
      status: "UNDER_REVIEW",
      resolvedAt: null,
    });

    // Closing without recording what was decided would leave both parties with
    // nothing, so it is refused.
    const undocumented = await decideDisputeAction(
      null,
      form({ disputeId: dispute.id, status: "RESOLVED", resolution: "" }),
    );
    expect(undocumented?.ok).toBe(false);

    const resolution =
      "The supplier confirmed 40 blocks were short and will deliver them by Friday at no extra cost.";
    const resolved = await decideDisputeAction(
      null,
      form({ disputeId: dispute.id, status: "RESOLVED", resolution }),
    );
    expect(resolved?.ok).toBe(true);

    const decided = await db.dispute.findUniqueOrThrow({ where: { id: dispute.id } });
    expect(decided.status).toBe("RESOLVED");
    expect(decided.resolvedById).toBe(admin.id);
    expect(decided.resolvedAt).not.toBeNull();

    // Both sides get the same words at the same time.
    for (const userId of [customer.id, supplierUser.id]) {
      const notice = await db.notification.findFirst({
        where: { userId, title: { contains: "decided" } },
      });
      expect(notice?.body).toContain("40 blocks were short");
    }

    const detail = await getDisputeForAdmin(dispute.id);
    expect(detail.resolution).toBe(resolution);
    expect(detail.order.items).toHaveLength(1);
  });

  it("refuses a dispute decision from somebody who is not an administrator", async () => {
    const { customer, order } = await disputableOrder();
    await signIn(customer.id);
    await raiseDisputeAction(
      null,
      form({
        orderId: order.id,
        reason: "WRONG_ITEM",
        description: "The supplier delivered 42.5N cement when I ordered 32.5N.",
      }),
    );
    const dispute = await db.dispute.findUniqueOrThrow({ where: { orderId: order.id } });

    const result = await decideDisputeAction(
      null,
      form({
        disputeId: dispute.id,
        status: "RESOLVED",
        resolution: "I am marking my own dispute resolved in my favour.",
      }),
    );

    expect(result?.ok).toBe(false);
    expect(await db.dispute.findUniqueOrThrow({ where: { id: dispute.id } })).toMatchObject({
      status: "OPEN",
    });
  });
});

describe("review moderation", () => {
  async function reviewedOrder(rating = 1) {
    const customer = await createUser();
    const { supplier } = await createSupplier({ ratingCount: 1, ratingAverageBps: rating * 10_000 });
    const order = await createOrder({
      customerId: customer.id,
      supplierId: supplier.id,
      status: "COMPLETED",
    });
    const review = await db.review.create({
      data: {
        orderId: order.id,
        customerId: customer.id,
        supplierId: supplier.id,
        rating,
        comment: "Abusive comment naming a driver and posting his phone number.",
        status: "FLAGGED",
      },
    });
    return { customer, supplier, review };
  }

  it("hides an abusive review, recalculates the rating and keeps the reason", async () => {
    const admin = await createAdmin();
    const { supplier, review } = await reviewedOrder();
    await signIn(admin.id);

    const blank = await moderateReviewAction(
      null,
      form({ reviewId: review.id, action: "HIDE", reason: "" }),
    );
    expect(blank?.ok).toBe(false);

    const hidden = await moderateReviewAction(
      null,
      form({
        reviewId: review.id,
        action: "HIDE",
        reason: "Names an employee and publishes their phone number.",
      }),
    );
    expect(hidden?.ok).toBe(true);

    expect(await db.review.findUniqueOrThrow({ where: { id: review.id } })).toMatchObject({
      status: "HIDDEN",
      hiddenReason: "Names an employee and publishes their phone number.",
    });

    // A hidden review must stop counting towards the published average.
    expect(await db.supplierProfile.findUniqueOrThrow({ where: { id: supplier.id } })).toMatchObject(
      { ratingCount: 0, ratingAverageBps: 0 },
    );

    const audit = await db.auditLog.findFirst({
      where: { resourceType: "review", resourceId: review.id },
    });
    expect(audit?.action).toBe("review.hidden");
  });

  it("reopens a review for the customer to amend rather than removing it", async () => {
    const admin = await createAdmin();
    const { customer, review } = await reviewedOrder(2);
    await signIn(admin.id);

    const result = await moderateReviewAction(
      null,
      form({ reviewId: review.id, action: "ALLOW_AMENDMENT", reason: "" }),
    );

    expect(result?.ok).toBe(true);
    expect(await db.review.findUniqueOrThrow({ where: { id: review.id } })).toMatchObject({
      amendmentAllowed: true,
      status: "FLAGGED",
    });

    const notice = await db.notification.findFirst({
      where: { userId: customer.id, type: "REVIEW_REMINDER" },
    });
    expect(notice?.linkUrl).toContain("/review");
  });
});

describe("platform settings", () => {
  it("only a super administrator can change them, and each change is audited", async () => {
    const admin = await createAdmin("ADMIN");
    const superAdmin = await createAdmin("SUPER_ADMIN");
    const fields = {
      "commission.enabled": "on",
      "commission.default_rate_bps": "400",
      "subscription.standard_price_minor": "300",
      "subscription.premium_price_minor": "750",
      "budget.alert_threshold_percent": "80",
      "orders.auto_complete_after_days": "10",
    };

    await signIn(admin.id);
    expect((await savePlatformSettingsAction(null, form(fields)))?.ok).toBe(false);

    await signIn(superAdmin.id);
    const saved = await savePlatformSettingsAction(null, form(fields));
    expect(saved?.ok).toBe(true);

    const settings = await getPlatformSettings();
    expect(settings["commission.enabled"]).toBe(true);
    expect(settings["commission.default_rate_bps"]).toBe(400);
    // Money is typed in Kwacha and stored in ngwee.
    expect(settings["subscription.standard_price_minor"]).toBe(30_000);

    const audit = await db.auditLog.findFirst({
      where: { resourceType: "platform_setting", resourceId: "commission.enabled" },
    });
    expect(audit?.actorUserId).toBe(superAdmin.id);

    // Saving the same values again changes nothing and writes no new audit rows.
    const again = await savePlatformSettingsAction(null, form(fields));
    expect(again?.ok).toBe(true);
    if (again?.ok) expect(again.data.updated).toBe(0);
  });

  it("rejects a commission rate that is not a whole number of basis points", async () => {
    const superAdmin = await createAdmin("SUPER_ADMIN");
    await signIn(superAdmin.id);

    const result = await savePlatformSettingsAction(
      null,
      form({
        "commission.enabled": "",
        "commission.default_rate_bps": "3.5",
        "subscription.standard_price_minor": "250",
        "subscription.premium_price_minor": "600",
        "budget.alert_threshold_percent": "85",
        "orders.auto_complete_after_days": "14",
      }),
    );

    expect(result?.ok).toBe(false);
  });
});

describe("administration reads", () => {
  beforeEach(async () => {
    const admin = await createAdmin();
    await signIn(admin.id);
  });

  it("counts the work queues the dashboard leads with", async () => {
    const { supplier } = await createSupplier({ verificationStatus: "PENDING" });
    await pendingDocument(supplier.id);
    await createProduct(supplier.id, { status: "PENDING_APPROVAL" });

    const dashboard = await getAdminDashboard();

    expect(dashboard.queues.pendingVerifications).toBe(1);
    expect(dashboard.queues.pendingDocuments).toBe(1);
    expect(dashboard.queues.pendingProducts).toBe(1);
  });

  it("filters and paginates users, suppliers, products and reviews", async () => {
    const { supplier } = await createSupplier({ businessName: "Ndola Roofing Centre" });
    await createProduct(supplier.id, { name: "IBR sheet 0.47mm", status: "ACTIVE" });
    await createProduct(supplier.id, { name: "Ridge cap", status: "PENDING_APPROVAL" });

    const suppliers = await listSuppliersForAdmin({ search: "Ndola" });
    expect(suppliers.suppliers).toHaveLength(1);
    expect(suppliers.suppliers[0]?.productCount).toBe(2);

    const pending = await listProductsForAdmin({ status: "PENDING_APPROVAL" });
    expect(pending.products.map((product) => product.name)).toEqual(["Ridge cap"]);

    const byName = await listProductsForAdmin({ search: "IBR" });
    expect(byName.products).toHaveLength(1);

    const admins = await listUsers({ role: "SUPER_ADMIN" });
    expect(admins.users.every((user) => user.role === "SUPER_ADMIN")).toBe(true);

    const reviews = await listReviewsForAdmin({ status: "PUBLISHED" });
    expect(reviews.total).toBe(0);
  });

  it("orders the dispute queue so the oldest open one is first", async () => {
    const { supplier } = await createSupplier();
    const customer = await createUser();

    const older = await createOrder({
      customerId: customer.id,
      supplierId: supplier.id,
      status: "DISPUTED",
    });
    const newer = await createOrder({
      customerId: customer.id,
      supplierId: supplier.id,
      status: "DISPUTED",
    });

    await db.dispute.create({
      data: {
        orderId: newer.id,
        raisedById: customer.id,
        supplierId: supplier.id,
        reason: "LATE_DELIVERY",
        description: "Raised today.",
        status: "OPEN",
      },
    });
    await db.dispute.create({
      data: {
        orderId: older.id,
        raisedById: customer.id,
        supplierId: supplier.id,
        reason: "ITEM_NOT_DELIVERED",
        description: "Raised a week ago.",
        status: "OPEN",
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    });

    const queue = await listDisputes();
    expect(queue[0]?.description).toBe("Raised a week ago.");
  });

  it("reports platform analytics without falling over on an empty window", async () => {
    const analytics = await getPlatformAnalytics(30);

    expect(analytics.windowDays).toBe(30);
    expect(analytics.orders.placed).toBe(0);
    expect(analytics.gmvMinor).toBe(0);
    expect(analytics.averageOrderMinor).toBe(0);
    expect(analytics.usersByRole.length).toBeGreaterThan(0);
  });

  it("counts completed orders and their value into the analytics window", async () => {
    const customer = await createUser();
    const { supplier } = await createSupplier();
    await createOrder({
      customerId: customer.id,
      supplierId: supplier.id,
      status: "COMPLETED",
      subtotalMinor: 500_00,
    });

    const analytics = await getPlatformAnalytics(30);
    expect(analytics.orders.placed).toBe(1);
    expect(analytics.orders.completed).toBe(1);
    expect(analytics.gmvMinor).toBe(500_00);
    expect(analytics.averageOrderMinor).toBe(500_00);
    expect(analytics.monthly.at(-1)?.orders).toBe(1);
  });

  it("lists the audit trail with the actions available to filter by", async () => {
    const customer = await createUser();
    const admin = await db.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } });
    await setUserStatusAction(
      null,
      form({ userId: customer.id, status: "SUSPENDED", reason: "Payment fraud on two orders." }),
    );

    const log = await listAuditLog({ resourceType: "user" });
    expect(log.total).toBeGreaterThan(0);
    expect(log.entries[0]?.actor?.id).toBe(admin.id);
    expect(log.actions.some((row) => row.action === "user.suspended")).toBe(true);

    const bySearch = await listAuditLog({ search: customer.id });
    expect(bySearch.total).toBeGreaterThan(0);
  });
});
