import type {
  BudgetCategoryKey,
  BudgetTransactionType,
  BusinessRegistrationStatus,
  ConstructionStage,
  ConstructionType,
  ContractStatus,
  DocumentReviewStatus,
  DeliveryMethod,
  DeliveryProviderType,
  DeliveryStatus,
  DisputeReason,
  DisputeStatus,
  FulfilmentMethod,
  NotificationType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductStatus,
  ProductUnit,
  ProjectStatus,
  PropertyType,
  SubscriptionTier,
  SupplierDocumentType,
  UserRole,
  UserStatus,
  VehicleType,
  VerificationStatus,
} from "@prisma/client";

/**
 * Presentation layer for database enums.
 *
 * Prisma enums are imported **type-only** so this module stays safe to use in
 * client components: the type import is erased at build time and no part of
 * `@prisma/client` reaches the browser bundle. The `satisfies` clauses make the
 * compiler fail if an enum member is added to the schema without a label here.
 */

export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "accent";

// --- Roles ------------------------------------------------------------------

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  CUSTOMER: "Customer",
  SUPPLIER: "Supplier",
  DELIVERY_PROVIDER: "Delivery provider",
  PROFESSIONAL: "Professional",
  ARTISAN: "Artisan",
  ADMIN: "Administrator",
  SUPER_ADMIN: "Super administrator",
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: "Active",
  PENDING_VERIFICATION: "Pending verification",
  SUSPENDED: "Suspended",
  DEACTIVATED: "Deactivated",
};

export const USER_STATUS_TONES: Record<UserStatus, BadgeTone> = {
  ACTIVE: "success",
  PENDING_VERIFICATION: "warning",
  SUSPENDED: "danger",
  DEACTIVATED: "neutral",
};

// --- Projects ---------------------------------------------------------------

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  HOUSE: "House",
  APARTMENT: "Apartment / flats",
  RENOVATION: "Renovation",
  COMMERCIAL: "Commercial property",
  BOUNDARY_WALL: "Boundary wall",
  OTHER: "Other",
};

export const PROPERTY_TYPES = [
  "HOUSE",
  "RENOVATION",
  "COMMERCIAL",
  "APARTMENT",
  "BOUNDARY_WALL",
  "OTHER",
] as const satisfies readonly PropertyType[];

export const CONSTRUCTION_TYPE_LABELS: Record<ConstructionType, string> = {
  NEW_BUILD: "New build",
  RENOVATION: "Renovation",
  EXTENSION: "Extension",
  FINISHING_ONLY: "Finishing only",
  OTHER: "Other",
};

export const CONSTRUCTION_TYPES = [
  "NEW_BUILD",
  "RENOVATION",
  "EXTENSION",
  "FINISHING_ONLY",
  "OTHER",
] as const satisfies readonly ConstructionType[];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const PROJECT_STATUSES = [
  "PLANNING",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "CANCELLED",
] as const satisfies readonly ProjectStatus[];

export const PROJECT_STATUS_TONES: Record<ProjectStatus, BadgeTone> = {
  PLANNING: "info",
  ACTIVE: "success",
  PAUSED: "warning",
  COMPLETED: "neutral",
  CANCELLED: "danger",
};

/** Ordered construction stages — the index doubles as baseline progress. */
export const CONSTRUCTION_STAGES = [
  "PLANNING",
  "SITE_PREPARATION",
  "FOUNDATION",
  "WALLING",
  "ROOFING",
  "PLUMBING",
  "ELECTRICAL",
  "PLASTERING",
  "FLOORING",
  "PAINTING",
  "FINISHING",
  "COMPLETED",
] as const satisfies readonly ConstructionStage[];

export const CONSTRUCTION_STAGE_LABELS: Record<ConstructionStage, string> = {
  PLANNING: "Planning",
  SITE_PREPARATION: "Site preparation",
  FOUNDATION: "Foundation",
  WALLING: "Walling",
  ROOFING: "Roofing",
  PLUMBING: "Plumbing",
  ELECTRICAL: "Electrical",
  PLASTERING: "Plastering",
  FLOORING: "Flooring",
  PAINTING: "Painting",
  FINISHING: "Finishing",
  COMPLETED: "Completed",
};

/**
 * Typical share of a build completed once a stage is reached. Used as the
 * suggested progress figure when a customer moves a project forward; they can
 * always override it.
 */
export const STAGE_PROGRESS_PERCENT: Record<ConstructionStage, number> = {
  PLANNING: 2,
  SITE_PREPARATION: 8,
  FOUNDATION: 18,
  WALLING: 34,
  ROOFING: 50,
  PLUMBING: 60,
  ELECTRICAL: 68,
  PLASTERING: 76,
  FLOORING: 84,
  PAINTING: 91,
  FINISHING: 97,
  COMPLETED: 100,
};

// --- Budgets ----------------------------------------------------------------

export const BUDGET_CATEGORY_KEYS = [
  "LAND_AND_SITE_PREPARATION",
  "FOUNDATION",
  "WALLING",
  "ROOFING",
  "PLUMBING",
  "ELECTRICAL",
  "DOORS_AND_WINDOWS",
  "FLOORING",
  "CEILING",
  "PAINTING",
  "KITCHEN",
  "BATHROOM",
  "LABOUR",
  "TRANSPORT",
  "PROFESSIONAL_FEES",
  "MISCELLANEOUS",
] as const satisfies readonly BudgetCategoryKey[];

export const BUDGET_CATEGORY_LABELS: Record<BudgetCategoryKey, string> = {
  LAND_AND_SITE_PREPARATION: "Land & site preparation",
  FOUNDATION: "Foundation",
  WALLING: "Walling",
  ROOFING: "Roofing",
  PLUMBING: "Plumbing",
  ELECTRICAL: "Electrical",
  DOORS_AND_WINDOWS: "Doors & windows",
  FLOORING: "Flooring",
  CEILING: "Ceiling",
  PAINTING: "Painting",
  KITCHEN: "Kitchen",
  BATHROOM: "Bathroom",
  LABOUR: "Labour",
  TRANSPORT: "Transport",
  PROFESSIONAL_FEES: "Professional fees",
  MISCELLANEOUS: "Miscellaneous",
};

/** Stable chart colours, cycling through the BuildLink palette. */
export const BUDGET_CATEGORY_COLOURS: Record<BudgetCategoryKey, string> = {
  LAND_AND_SITE_PREPARATION: "#0f7a4f",
  FOUNDATION: "#14634a",
  WALLING: "#1f8a5c",
  ROOFING: "#e08a1e",
  PLUMBING: "#2d9c8a",
  ELECTRICAL: "#c9741a",
  DOORS_AND_WINDOWS: "#3f7f5f",
  FLOORING: "#8a6d3b",
  CEILING: "#5b8f7c",
  PAINTING: "#d9a441",
  KITCHEN: "#2f6f4f",
  BATHROOM: "#4a9c9c",
  LABOUR: "#6b7280",
  TRANSPORT: "#9a7b4f",
  PROFESSIONAL_FEES: "#4b6b8a",
  MISCELLANEOUS: "#94a3b8",
};

export const BUDGET_TRANSACTION_TYPE_LABELS: Record<BudgetTransactionType, string> = {
  EXPENSE: "Expense",
  MATERIAL_PURCHASE: "Material purchase",
  DEPOSIT: "Deposit",
  REFUND: "Refund",
  ADJUSTMENT: "Adjustment",
};

// --- Catalogue --------------------------------------------------------------

export const PRODUCT_UNITS = [
  "BAG",
  "PIECE",
  "TON",
  "CUBIC_METRE",
  "TRUCK",
  "METRE",
  "KILOGRAM",
  "BOX",
  "BUNDLE",
  "SHEET",
  "LITRE",
  "OTHER",
] as const satisfies readonly ProductUnit[];

export const PRODUCT_UNIT_LABELS: Record<ProductUnit, string> = {
  BAG: "Bag",
  PIECE: "Piece",
  TON: "Ton",
  CUBIC_METRE: "Cubic metre",
  TRUCK: "Truck load",
  METRE: "Metre",
  KILOGRAM: "Kilogram",
  BOX: "Box",
  BUNDLE: "Bundle",
  SHEET: "Sheet",
  LITRE: "Litre",
  OTHER: "Unit",
};

/** Short suffix for prices: `ZMW 185.00 / bag`. */
export const PRODUCT_UNIT_SHORT: Record<ProductUnit, string> = {
  BAG: "bag",
  PIECE: "piece",
  TON: "ton",
  CUBIC_METRE: "m³",
  TRUCK: "truck",
  METRE: "m",
  KILOGRAM: "kg",
  BOX: "box",
  BUNDLE: "bundle",
  SHEET: "sheet",
  LITRE: "litre",
  OTHER: "unit",
};

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  REJECTED: "Rejected",
  ARCHIVED: "Archived",
};

export const PRODUCT_STATUS_TONES: Record<ProductStatus, BadgeTone> = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "warning",
  ACTIVE: "success",
  INACTIVE: "neutral",
  REJECTED: "danger",
  ARCHIVED: "neutral",
};

// --- Suppliers --------------------------------------------------------------

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  UNVERIFIED: "Unverified",
  PENDING: "Pending verification",
  VERIFIED: "Verified supplier",
  REJECTED: "Verification rejected",
  SUSPENDED: "Suspended",
};

export const VERIFICATION_STATUS_TONES: Record<VerificationStatus, BadgeTone> = {
  UNVERIFIED: "neutral",
  PENDING: "warning",
  VERIFIED: "success",
  REJECTED: "danger",
  SUSPENDED: "danger",
};

/** Plain-language explanation shown beside every verification badge. */
export const VERIFICATION_STATUS_EXPLAINERS: Record<VerificationStatus, string> = {
  UNVERIFIED:
    "BuildLink has not checked this business. Confirm details yourself before paying.",
  PENDING: "Documents submitted. BuildLink is still reviewing this business.",
  VERIFIED: "BuildLink reviewed this business's registration documents.",
  REJECTED: "BuildLink could not confirm this business's documents.",
  SUSPENDED: "Trading is suspended while BuildLink reviews reported issues.",
};

export const SUPPLIER_DOCUMENT_TYPES = [
  "BUSINESS_REGISTRATION_CERTIFICATE",
  "TAX_CLEARANCE",
  "DIRECTOR_IDENTIFICATION",
  "PROOF_OF_ADDRESS",
  "OTHER",
] as const satisfies readonly SupplierDocumentType[];

export const SUPPLIER_DOCUMENT_TYPE_LABELS: Record<SupplierDocumentType, string> = {
  BUSINESS_REGISTRATION_CERTIFICATE: "PACRA certificate of incorporation",
  TAX_CLEARANCE: "ZRA tax clearance certificate",
  DIRECTOR_IDENTIFICATION: "Director's NRC or passport",
  PROOF_OF_ADDRESS: "Proof of business address",
  OTHER: "Other supporting document",
};

/** What each document is for, in the supplier's own terms. */
export const SUPPLIER_DOCUMENT_TYPE_HINTS: Record<SupplierDocumentType, string> = {
  BUSINESS_REGISTRATION_CERTIFICATE:
    "The certificate PACRA issued when the business was registered.",
  TAX_CLEARANCE: "A current tax clearance certificate from ZRA.",
  DIRECTOR_IDENTIFICATION: "A clear photograph or scan of the NRC or passport of a director.",
  PROOF_OF_ADDRESS: "A utility bill, lease or council letter showing the trading address.",
  OTHER: "Anything else that helps BuildLink confirm the business is real.",
};

export const DOCUMENT_REVIEW_STATUS_LABELS: Record<DocumentReviewStatus, string> = {
  PENDING: "Awaiting review",
  APPROVED: "Accepted",
  REJECTED: "Rejected",
};

export const DOCUMENT_REVIEW_STATUS_TONES: Record<DocumentReviewStatus, BadgeTone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export const BUSINESS_REGISTRATION_STATUS_LABELS: Record<BusinessRegistrationStatus, string> = {
  NOT_PROVIDED: "No registration details given",
  SELF_DECLARED: "Registration number self-declared",
  DOCUMENTS_SUBMITTED: "Registration documents submitted",
  VERIFIED: "Registration verified by BuildLink",
};

export const SUBSCRIPTION_TIER_LABELS: Record<SubscriptionTier, string> = {
  FREE: "Free",
  STANDARD: "Standard",
  PREMIUM: "Premium",
};

// --- Orders -----------------------------------------------------------------

export const ORDER_STATUSES = [
  "DRAFT",
  "PENDING_PAYMENT",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "PROCESSING",
  "READY_FOR_DELIVERY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
  "REFUNDED",
] as const satisfies readonly OrderStatus[];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: "Draft",
  PENDING_PAYMENT: "Awaiting your payment",
  PAYMENT_PENDING: "Payment confirmation pending",
  CONFIRMED: "Confirmed by supplier",
  PROCESSING: "Being prepared",
  READY_FOR_DELIVERY: "Ready for delivery",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  DISPUTED: "Disputed",
  REFUNDED: "Refunded",
};

/** Wording used in the supplier console, where "your payment" makes no sense. */
export const ORDER_STATUS_LABELS_SUPPLIER: Record<OrderStatus, string> = {
  ...ORDER_STATUS_LABELS,
  PENDING_PAYMENT: "Awaiting customer payment",
  CONFIRMED: "Confirmed",
};

export const ORDER_STATUS_TONES: Record<OrderStatus, BadgeTone> = {
  DRAFT: "neutral",
  PENDING_PAYMENT: "warning",
  PAYMENT_PENDING: "warning",
  CONFIRMED: "info",
  PROCESSING: "info",
  READY_FOR_DELIVERY: "info",
  OUT_FOR_DELIVERY: "accent",
  DELIVERED: "success",
  COMPLETED: "success",
  CANCELLED: "neutral",
  DISPUTED: "danger",
  REFUNDED: "neutral",
};

export const FULFILMENT_METHOD_LABELS: Record<FulfilmentMethod, string> = {
  SUPPLIER_DELIVERY: "Supplier delivery",
  THIRD_PARTY_DELIVERY: "Third-party delivery",
  CUSTOMER_PICKUP: "I will collect",
};

export const FULFILMENT_METHODS = [
  "SUPPLIER_DELIVERY",
  "THIRD_PARTY_DELIVERY",
  "CUSTOMER_PICKUP",
] as const satisfies readonly FulfilmentMethod[];

// --- Payments ---------------------------------------------------------------

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  INITIATED: "Initiated",
  PENDING: "Pending",
  SUCCESSFUL: "Successful",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export const PAYMENT_STATUS_TONES: Record<PaymentStatus, BadgeTone> = {
  INITIATED: "info",
  PENDING: "warning",
  SUCCESSFUL: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
  REFUNDED: "neutral",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  RECORDED_BANK_TRANSFER: "Bank transfer (recorded)",
  RECORDED_CASH: "Cash (recorded)",
  RECORDED_MOBILE_MONEY: "Mobile money (recorded)",
  MOBILE_MONEY: "Mobile money",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  SANDBOX: "Sandbox test payment",
};

/**
 * Methods where money moves directly between customer and supplier and
 * BuildLink only keeps the record. Surfaced in the UI so nobody believes
 * BuildLink is holding or guaranteeing funds.
 */
export const RECORDED_PAYMENT_METHODS = [
  "RECORDED_BANK_TRANSFER",
  "RECORDED_CASH",
  "RECORDED_MOBILE_MONEY",
] as const satisfies readonly PaymentMethod[];

export function isRecordedPaymentMethod(method: PaymentMethod): boolean {
  return (RECORDED_PAYMENT_METHODS as readonly PaymentMethod[]).includes(method);
}

// --- Contracts --------------------------------------------------------------

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent — awaiting response",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
};

export const CONTRACT_STATUS_TONES: Record<ContractStatus, BadgeTone> = {
  DRAFT: "neutral",
  SENT: "warning",
  ACCEPTED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
  COMPLETED: "success",
};

// --- Delivery ---------------------------------------------------------------

export const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
  SUPPLIER_DELIVERY: "Supplier delivery",
  THIRD_PARTY_DELIVERY: "Third-party delivery",
  CUSTOMER_PICKUP: "Customer pickup",
};

export const DELIVERY_STATUSES = [
  "REQUESTED",
  "ASSIGNED",
  "ACCEPTED",
  "PICKED_UP",
  "IN_TRANSIT",
  "DELIVERED",
  "FAILED",
  "CANCELLED",
] as const satisfies readonly DeliveryStatus[];

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  REQUESTED: "Requested",
  ASSIGNED: "Assigned to provider",
  ACCEPTED: "Accepted by provider",
  PICKED_UP: "Picked up",
  IN_TRANSIT: "In transit",
  DELIVERED: "Delivered",
  FAILED: "Delivery failed",
  CANCELLED: "Cancelled",
};

export const DELIVERY_STATUS_TONES: Record<DeliveryStatus, BadgeTone> = {
  REQUESTED: "warning",
  ASSIGNED: "info",
  ACCEPTED: "info",
  PICKED_UP: "accent",
  IN_TRANSIT: "accent",
  DELIVERED: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
};

export const DELIVERY_PROVIDER_TYPE_LABELS: Record<DeliveryProviderType, string> = {
  INDEPENDENT_DRIVER: "Independent driver",
  LOGISTICS_COMPANY: "Logistics company",
  SUPPLIER_FLEET: "Supplier fleet",
};

export const VEHICLE_TYPES = [
  "PICKUP",
  "VAN",
  "LIGHT_TRUCK",
  "TIPPER_TRUCK",
  "FLATBED_TRUCK",
  "HEAVY_TRUCK",
  "TRACTOR_TRAILER",
] as const satisfies readonly VehicleType[];

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  PICKUP: "Pickup",
  VAN: "Van",
  LIGHT_TRUCK: "Light truck",
  TIPPER_TRUCK: "Tipper truck",
  FLATBED_TRUCK: "Flatbed truck",
  HEAVY_TRUCK: "Heavy truck",
  TRACTOR_TRAILER: "Tractor trailer",
};

// --- Disputes & notifications ----------------------------------------------

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  OPEN: "Open",
  UNDER_REVIEW: "Under review",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const DISPUTE_STATUS_TONES: Record<DisputeStatus, BadgeTone> = {
  OPEN: "danger",
  UNDER_REVIEW: "warning",
  RESOLVED: "success",
  CLOSED: "neutral",
};

export const DISPUTE_REASONS = [
  "ITEM_NOT_DELIVERED",
  "WRONG_ITEM",
  "QUALITY_ISSUE",
  "QUANTITY_SHORTFALL",
  "LATE_DELIVERY",
  "PAYMENT_ISSUE",
  "OTHER",
] as const satisfies readonly DisputeReason[];

export const DISPUTE_REASON_LABELS: Record<DisputeReason, string> = {
  ITEM_NOT_DELIVERED: "Item not delivered",
  WRONG_ITEM: "Wrong item supplied",
  QUALITY_ISSUE: "Quality issue",
  QUANTITY_SHORTFALL: "Quantity short",
  LATE_DELIVERY: "Late delivery",
  PAYMENT_ISSUE: "Payment issue",
  OTHER: "Other",
};

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  ORDER_PLACED: "Order placed",
  ORDER_ACCEPTED: "Order accepted",
  ORDER_REJECTED: "Order rejected",
  ORDER_STATUS_CHANGED: "Order updated",
  PAYMENT_RECEIVED: "Payment recorded",
  PAYMENT_FAILED: "Payment failed",
  CONTRACT_SENT: "Agreement sent",
  CONTRACT_ACCEPTED: "Agreement accepted",
  CONTRACT_REJECTED: "Agreement rejected",
  DELIVERY_SCHEDULED: "Delivery scheduled",
  DELIVERY_DISPATCHED: "Delivery dispatched",
  DELIVERY_COMPLETED: "Delivery completed",
  REVIEW_REMINDER: "Review reminder",
  SUPPLIER_VERIFICATION_UPDATE: "Verification update",
  PROJECT_BUDGET_ALERT: "Budget alert",
  DISPUTE_UPDATE: "Dispute update",
};
