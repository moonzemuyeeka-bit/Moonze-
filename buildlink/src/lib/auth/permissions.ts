import type { UserRole } from "@prisma/client";

/**
 * Role-based access control.
 *
 * Permissions are declared once here and granted per role. Adding a role
 * (PROFESSIONAL, ARTISAN and the future financing/insurance actors) is a matter
 * of adding a row to `ROLE_PERMISSIONS` — no call site changes, because every
 * guard asks for a *permission*, never a role name.
 *
 * This module is pure (no database, no `server-only`) so the whole matrix is
 * unit-testable and can also drive navigation rendering.
 */

export const PERMISSIONS = [
  // Customer surface
  "project:manage",
  "cart:use",
  "order:place",
  "order:cancel_own",
  "review:write",
  "wallet:manage",
  "contract:respond_as_customer",
  "dispute:raise",
  "palette:analyse",

  // Supplier surface
  "supplier:manage_own_profile",
  "supplier:onboard",
  "product:manage_own",
  "order:fulfil",
  "contract:respond_as_supplier",
  "delivery:arrange_for_own_orders",
  "analytics:view_own",

  // Delivery surface
  "delivery:manage_own_jobs",
  "delivery:manage_own_fleet",

  // Future professional/artisan surfaces
  "profile:manage_professional",
  "profile:manage_artisan",

  // Administration
  "admin:view_dashboard",
  "admin:manage_users",
  "admin:verify_suppliers",
  "admin:moderate_products",
  "admin:manage_orders",
  "admin:view_payments",
  "admin:audit_contracts",
  "admin:resolve_disputes",
  "admin:view_audit_log",
  "admin:manage_platform_settings",
  "admin:manage_admins",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const CUSTOMER_PERMISSIONS: Permission[] = [
  "project:manage",
  "cart:use",
  "order:place",
  "order:cancel_own",
  "review:write",
  "wallet:manage",
  "contract:respond_as_customer",
  "dispute:raise",
  "palette:analyse",
];

const SUPPLIER_PERMISSIONS: Permission[] = [
  "supplier:manage_own_profile",
  "supplier:onboard",
  "product:manage_own",
  "order:fulfil",
  "contract:respond_as_supplier",
  "delivery:arrange_for_own_orders",
  "analytics:view_own",
];

const DELIVERY_PERMISSIONS: Permission[] = [
  "delivery:manage_own_jobs",
  "delivery:manage_own_fleet",
];

const ADMIN_PERMISSIONS: Permission[] = [
  "admin:view_dashboard",
  "admin:manage_users",
  "admin:verify_suppliers",
  "admin:moderate_products",
  "admin:manage_orders",
  "admin:view_payments",
  "admin:audit_contracts",
  "admin:resolve_disputes",
  "admin:view_audit_log",
  "admin:manage_platform_settings",
];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  CUSTOMER: CUSTOMER_PERMISSIONS,
  SUPPLIER: [
    ...SUPPLIER_PERMISSIONS,
    // Suppliers buy materials too, so they keep the shopping surface.
    "cart:use",
    "order:place",
    "project:manage",
    // Either party to an order can escalate it: a customer who never paid is as
    // real a problem as materials that never arrived.
    "dispute:raise",
  ],
  DELIVERY_PROVIDER: DELIVERY_PERMISSIONS,
  PROFESSIONAL: ["profile:manage_professional", "cart:use", "order:place", "project:manage"],
  ARTISAN: ["profile:manage_artisan"],
  ADMIN: ADMIN_PERMISSIONS,
  SUPER_ADMIN: [...ADMIN_PERMISSIONS, "admin:manage_admins"],
};

export function permissionsFor(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}

export function roleHasAnyPermission(role: UserRole, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => roleHasPermission(role, permission));
}

export const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"] as const satisfies readonly UserRole[];

export function isAdminRole(role: UserRole): boolean {
  return (ADMIN_ROLES as readonly UserRole[]).includes(role);
}

/** Where a role lands after signing in. */
export const ROLE_HOME_PATH: Record<UserRole, string> = {
  CUSTOMER: "/customer/dashboard",
  SUPPLIER: "/supplier/dashboard",
  DELIVERY_PROVIDER: "/delivery",
  PROFESSIONAL: "/marketplace",
  ARTISAN: "/marketplace",
  ADMIN: "/admin/dashboard",
  SUPER_ADMIN: "/admin/dashboard",
};

/**
 * Route prefixes that require authentication, with the permission each one
 * demands. Middleware uses the prefixes for a cheap redirect; the authoritative
 * check always happens server-side in the page or action.
 */
export const PROTECTED_ROUTE_PERMISSIONS: ReadonlyArray<{
  prefix: string;
  permission: Permission;
}> = [
  { prefix: "/customer", permission: "project:manage" },
  { prefix: "/supplier/dashboard", permission: "supplier:manage_own_profile" },
  { prefix: "/supplier/products", permission: "product:manage_own" },
  { prefix: "/supplier/orders", permission: "order:fulfil" },
  { prefix: "/supplier/contracts", permission: "contract:respond_as_supplier" },
  { prefix: "/supplier/customers", permission: "supplier:manage_own_profile" },
  { prefix: "/supplier/analytics", permission: "analytics:view_own" },
  { prefix: "/supplier/verification", permission: "supplier:onboard" },
  { prefix: "/supplier/settings", permission: "supplier:manage_own_profile" },
  { prefix: "/delivery", permission: "delivery:manage_own_jobs" },
  { prefix: "/admin", permission: "admin:view_dashboard" },
];

/** Paths that need a signed-in user but are shared across roles. */
export const AUTHENTICATED_ROUTE_PREFIXES = [
  "/cart",
  "/checkout",
  "/orders",
  "/agreements",
  "/notifications",
  "/account",
] as const;
