import {
  BarChart3,
  Bell,
  Blocks,
  Calculator,
  ClipboardList,
  FileText,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  Package,
  Palette,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Star,
  Store,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import type { UserRole } from "@prisma/client";

/**
 * Navigation model.
 *
 * One declaration drives the desktop sidebar, the mobile bottom bar and the
 * account menu, so a new area cannot appear in one and be missing from another.
 * Entries are chosen per role; the bottom bar takes the first four `onMobile`
 * items because five targets is the most a thumb can hit reliably.
 */

export type NavItem = {
  href: string;
  label: string;
  /** Shorter label for the mobile bottom bar. */
  shortLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Include in the mobile bottom bar. */
  onMobile?: boolean;
  /** Match child routes as active (`/customer/projects/abc`). */
  matchNested?: boolean;
  badge?: "cart" | "notifications";
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

const MARKETPLACE_ITEMS: NavItem[] = [
  {
    href: "/marketplace",
    label: "Marketplace",
    shortLabel: "Shop",
    icon: Search,
    onMobile: true,
    matchNested: true,
  },
  { href: "/marketplace/suppliers", label: "Suppliers", icon: Store, matchNested: true },
  { href: "/cart", label: "Cart", shortLabel: "Cart", icon: ShoppingCart, onMobile: true, badge: "cart" },
];

const CUSTOMER_SECTIONS: NavSection[] = [
  {
    title: "My build",
    items: [
      {
        href: "/customer/dashboard",
        label: "Dashboard",
        shortLabel: "Home",
        icon: LayoutDashboard,
        onMobile: true,
      },
      {
        href: "/customer/projects",
        label: "Projects",
        shortLabel: "Projects",
        icon: FolderKanban,
        onMobile: true,
        matchNested: true,
      },
      { href: "/customer/budget", label: "Budget & wallet", icon: Wallet, matchNested: true },
      { href: "/orders", label: "My orders", icon: Receipt, matchNested: true },
      { href: "/customer/contracts", label: "Agreements", icon: FileText, matchNested: true },
    ],
  },
  { title: "Buy materials", items: MARKETPLACE_ITEMS },
  {
    title: "Planning tools",
    items: [
      { href: "/customer/planner", label: "Material estimator", icon: Calculator },
      { href: "/customer/finishes", label: "Finish & colour ideas", icon: Palette, matchNested: true },
    ],
  },
];

const SUPPLIER_SECTIONS: NavSection[] = [
  {
    title: "My business",
    items: [
      {
        href: "/supplier/dashboard",
        label: "Dashboard",
        shortLabel: "Home",
        icon: Gauge,
        onMobile: true,
      },
      {
        href: "/supplier/orders",
        label: "Orders",
        shortLabel: "Orders",
        icon: ClipboardList,
        onMobile: true,
        matchNested: true,
      },
      {
        href: "/supplier/products",
        label: "Products",
        shortLabel: "Products",
        icon: Package,
        onMobile: true,
        matchNested: true,
      },
      { href: "/supplier/contracts", label: "Agreements", icon: FileText, matchNested: true },
      { href: "/supplier/customers", label: "Customers", icon: Users },
      { href: "/supplier/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    title: "Business setup",
    items: [
      { href: "/supplier/verification", label: "Verification", icon: ShieldCheck },
      { href: "/supplier/settings", label: "Business settings", icon: Settings },
    ],
  },
  {
    title: "Buy materials",
    items: [
      { href: "/marketplace", label: "Marketplace", icon: Search, matchNested: true },
      { href: "/cart", label: "Cart", icon: ShoppingCart, badge: "cart" },
    ],
  },
];

const DELIVERY_SECTIONS: NavSection[] = [
  {
    title: "Deliveries",
    items: [
      { href: "/delivery", label: "Available jobs", shortLabel: "Jobs", icon: Truck, onMobile: true },
      {
        href: "/delivery/assigned",
        label: "My deliveries",
        shortLabel: "Mine",
        icon: ClipboardList,
        onMobile: true,
        matchNested: true,
      },
    ],
  },
  {
    title: "My operation",
    items: [
      { href: "/delivery/fleet", label: "Vehicles", shortLabel: "Fleet", icon: Blocks, onMobile: true },
      { href: "/delivery/areas", label: "Service areas", icon: Store },
      { href: "/delivery/settings", label: "Settings", icon: Settings },
    ],
  },
];

const ADMIN_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      {
        href: "/admin/dashboard",
        label: "Dashboard",
        shortLabel: "Home",
        icon: Gauge,
        onMobile: true,
      },
      { href: "/admin/analytics", label: "Platform analytics", icon: BarChart3 },
    ],
  },
  {
    title: "Marketplace",
    items: [
      {
        href: "/admin/suppliers",
        label: "Suppliers",
        shortLabel: "Suppliers",
        icon: Store,
        onMobile: true,
        matchNested: true,
      },
      {
        href: "/admin/products",
        label: "Products",
        shortLabel: "Products",
        icon: Package,
        onMobile: true,
        matchNested: true,
      },
      { href: "/admin/orders", label: "Orders", icon: ClipboardList, matchNested: true },
      { href: "/admin/payments", label: "Payments", icon: Receipt },
      { href: "/admin/contracts", label: "Agreements", icon: FileText },
      { href: "/admin/reviews", label: "Reviews", icon: Star },
      { href: "/admin/disputes", label: "Disputes", icon: ShieldCheck, matchNested: true },
    ],
  },
  {
    title: "Platform",
    items: [
      { href: "/admin/users", label: "Users", shortLabel: "Users", icon: Users, onMobile: true, matchNested: true },
      { href: "/admin/audit", label: "Audit log", icon: ClipboardList },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

const GUEST_SECTIONS: NavSection[] = [{ title: "Browse", items: MARKETPLACE_ITEMS }];

export function navigationFor(role: UserRole | null): NavSection[] {
  switch (role) {
    case "CUSTOMER":
    case "PROFESSIONAL":
    case "ARTISAN":
      return CUSTOMER_SECTIONS;
    case "SUPPLIER":
      return SUPPLIER_SECTIONS;
    case "DELIVERY_PROVIDER":
      return DELIVERY_SECTIONS;
    case "ADMIN":
    case "SUPER_ADMIN":
      return ADMIN_SECTIONS;
    default:
      return GUEST_SECTIONS;
  }
}

/** First four mobile-flagged items, plus a "More" target rendered by the bar. */
export function mobileNavigationFor(role: UserRole | null): NavItem[] {
  return navigationFor(role)
    .flatMap((section) => section.items)
    .filter((item) => item.onMobile === true)
    .slice(0, 4);
}

export const ACCOUNT_ITEMS: NavItem[] = [
  { href: "/account", label: "Account settings", icon: Settings },
  { href: "/notifications", label: "Notifications", icon: Bell, badge: "notifications" },
];
