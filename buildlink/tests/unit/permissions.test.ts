import type { UserRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  ADMIN_ROLES,
  isAdminRole,
  PERMISSIONS,
  permissionsFor,
  PROTECTED_ROUTE_PERMISSIONS,
  ROLE_HOME_PATH,
  ROLE_PERMISSIONS,
  roleHasAnyPermission,
  roleHasPermission,
  type Permission,
} from "@/lib/auth/permissions";

const ALL_ROLES = Object.keys(ROLE_PERMISSIONS) as UserRole[];

describe("permission matrix", () => {
  it("grants every role only permissions that exist", () => {
    for (const role of ALL_ROLES) {
      for (const permission of permissionsFor(role)) {
        expect(PERMISSIONS, `${role} has unknown permission ${permission}`).toContain(permission);
      }
    }
  });

  it("declares no duplicate permissions per role", () => {
    for (const role of ALL_ROLES) {
      const granted = permissionsFor(role);
      expect(new Set(granted).size, `${role} lists a permission twice`).toBe(granted.length);
    }
  });

  it("gives every role a landing page", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_HOME_PATH[role]).toMatch(/^\//);
    }
  });

  it("keeps customer and supplier surfaces separate", () => {
    expect(roleHasPermission("CUSTOMER", "project:manage")).toBe(true);
    expect(roleHasPermission("CUSTOMER", "product:manage_own")).toBe(false);
    expect(roleHasPermission("CUSTOMER", "order:fulfil")).toBe(false);
    expect(roleHasPermission("SUPPLIER", "product:manage_own")).toBe(true);
    expect(roleHasPermission("SUPPLIER", "review:write")).toBe(false);
  });

  it("lets suppliers and professionals shop like customers", () => {
    for (const role of ["SUPPLIER", "PROFESSIONAL"] as const) {
      expect(roleHasPermission(role, "cart:use")).toBe(true);
      expect(roleHasPermission(role, "order:place")).toBe(true);
    }
  });

  it("denies every admin permission to every non-admin role", () => {
    const adminPermissions = PERMISSIONS.filter((permission) =>
      permission.startsWith("admin:"),
    ) as Permission[];

    for (const role of ALL_ROLES.filter((candidate) => !isAdminRole(candidate))) {
      expect(roleHasAnyPermission(role, adminPermissions), `${role} can reach admin`).toBe(false);
    }
  });

  it("reserves admin management for the super admin", () => {
    expect(roleHasPermission("ADMIN", "admin:manage_admins")).toBe(false);
    expect(roleHasPermission("SUPER_ADMIN", "admin:manage_admins")).toBe(true);
    expect(roleHasPermission("ADMIN", "admin:verify_suppliers")).toBe(true);
  });

  it("gives the super admin a superset of the admin permissions", () => {
    for (const permission of permissionsFor("ADMIN")) {
      expect(roleHasPermission("SUPER_ADMIN", permission)).toBe(true);
    }
  });

  it("does not let admins masquerade as traders", () => {
    // Admins moderate the marketplace; they do not buy, sell or review in it.
    expect(roleHasPermission("ADMIN", "order:place")).toBe(false);
    expect(roleHasPermission("ADMIN", "product:manage_own")).toBe(false);
    expect(roleHasPermission("ADMIN", "review:write")).toBe(false);
  });

  it("limits delivery providers to their own jobs and fleet", () => {
    expect(permissionsFor("DELIVERY_PROVIDER")).toEqual([
      "delivery:manage_own_jobs",
      "delivery:manage_own_fleet",
    ]);
  });

  it("returns nothing for an unknown role rather than throwing", () => {
    expect(permissionsFor("NOT_A_ROLE" as UserRole)).toEqual([]);
    expect(roleHasPermission("NOT_A_ROLE" as UserRole, "project:manage")).toBe(false);
  });

  it("treats exactly ADMIN and SUPER_ADMIN as admin roles", () => {
    expect(ADMIN_ROLES).toEqual(["ADMIN", "SUPER_ADMIN"]);
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isAdminRole("SUPER_ADMIN")).toBe(true);
    expect(isAdminRole("SUPPLIER")).toBe(false);
  });
});

describe("protected route table", () => {
  it("guards each prefix with a permission that exists", () => {
    for (const entry of PROTECTED_ROUTE_PERMISSIONS) {
      expect(entry.prefix).toMatch(/^\//);
      expect(PERMISSIONS).toContain(entry.permission);
    }
  });

  it("protects the admin, supplier, customer and delivery consoles", () => {
    const prefixes = PROTECTED_ROUTE_PERMISSIONS.map((entry) => entry.prefix);
    expect(prefixes).toEqual(
      expect.arrayContaining(["/admin", "/customer", "/delivery", "/supplier/products"]),
    );
  });

  it("admits only the intended roles to each guarded prefix", () => {
    const permissionFor = (prefix: string) =>
      PROTECTED_ROUTE_PERMISSIONS.find((entry) => entry.prefix === prefix)!.permission;

    expect(roleHasPermission("CUSTOMER", permissionFor("/customer"))).toBe(true);
    expect(roleHasPermission("DELIVERY_PROVIDER", permissionFor("/customer"))).toBe(false);
    expect(roleHasPermission("SUPPLIER", permissionFor("/supplier/products"))).toBe(true);
    expect(roleHasPermission("CUSTOMER", permissionFor("/supplier/products"))).toBe(false);
    expect(roleHasPermission("ADMIN", permissionFor("/admin"))).toBe(true);
    expect(roleHasPermission("SUPPLIER", permissionFor("/admin"))).toBe(false);
  });
});
