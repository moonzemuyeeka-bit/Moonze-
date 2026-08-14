"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, MoreHorizontal, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ACCOUNT_ITEMS,
  mobileNavigationFor,
  navigationFor,
  type NavItem,
} from "@/components/layout/nav-config";
import { USER_ROLE_LABELS } from "@/lib/labels";
import { logoutAction } from "@/server/auth/actions";
import type { UserRole } from "@prisma/client";

export type NavCounts = { cart: number; notifications: number };

function useIsActive() {
  const pathname = usePathname();
  return React.useCallback(
    (item: NavItem) => {
      if (item.matchNested) {
        return pathname === item.href || pathname.startsWith(`${item.href}/`);
      }
      return pathname === item.href;
    },
    [pathname],
  );
}

function badgeCount(item: NavItem, counts: NavCounts): number {
  if (item.badge === "cart") return counts.cart;
  if (item.badge === "notifications") return counts.notifications;
  return 0;
}

/** Desktop sidebar. Hidden below `lg`, where the bottom bar takes over. */
export function AppSidebar({
  role,
  counts,
}: {
  role: UserRole | null;
  counts: NavCounts;
}) {
  const sections = navigationFor(role);
  const isActive = useIsActive();

  return (
    <nav aria-label="Sections" className="space-y-6 p-4">
      {sections.map((section) => (
        <div key={section.title}>
          <h2 className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
            {section.title}
          </h2>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(item);
              const count = badgeCount(item, counts);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-brand-50 text-brand-800"
                        : "text-foreground-muted hover:bg-surface-muted hover:text-foreground",
                    )}
                  >
                    <item.icon
                      className={cn("size-4.5 shrink-0", active ? "text-brand-700" : "text-ink-400")}
                    />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {count > 0 ? (
                      <Badge tone={item.badge === "cart" ? "accent" : "danger"} size="sm">
                        {count > 99 ? "99+" : count}
                      </Badge>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/**
 * Mobile bottom navigation.
 *
 * Fixed to the bottom edge with safe-area padding, so it clears the iOS home
 * indicator. Four primary destinations plus a "More" menu keeps every target
 * comfortably thumb-sized.
 */
export function MobileNav({
  role,
  counts,
  userName,
  isSignedIn,
}: {
  role: UserRole | null;
  counts: NavCounts;
  userName: string;
  isSignedIn: boolean;
}) {
  const items = mobileNavigationFor(role);
  const isActive = useIsActive();
  const sections = navigationFor(role);
  const primaryHrefs = new Set(items.map((item) => item.href));
  const overflow = sections
    .flatMap((section) => section.items)
    .filter((item) => !primaryHrefs.has(item.href));

  return (
    <nav
      aria-label="Primary"
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/98 backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
        {items.map((item) => {
          const active = isActive(item);
          const count = badgeCount(item, counts);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[0.6875rem] font-medium",
                  active ? "text-brand-700" : "text-foreground-muted",
                )}
              >
                <span className="relative">
                  <item.icon className="size-5.5" />
                  {count > 0 ? (
                    <span className="absolute -right-2 -top-1.5 flex size-4 items-center justify-center rounded-full bg-gold-500 text-[0.5625rem] font-bold text-ink-950">
                      {count > 9 ? "9+" : count}
                    </span>
                  ) : null}
                </span>
                <span className="truncate">{item.shortLabel ?? item.label}</span>
              </Link>
            </li>
          );
        })}

        <li className="flex-1">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[0.6875rem] font-medium text-foreground-muted">
              <MoreHorizontal className="size-5.5" />
              <span>More</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="mb-1 max-h-[60dvh] overflow-y-auto">
              {overflow.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href}>
                    <item.icon />
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {isSignedIn ? (
                <>
                  <DropdownMenuLabel>{userName}</DropdownMenuLabel>
                  {ACCOUNT_ITEMS.map((item) => (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link href={item.href}>
                        <item.icon />
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem asChild>
                    <button type="submit" form={LOGOUT_FORM_ID} className="w-full">
                      <LogOut />
                      Sign out
                    </button>
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem asChild>
                    <Link href="/login">
                      <User />
                      Sign in
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/register">Create an account</Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      </ul>
    </nav>
  );
}

/** Avatar menu in the top bar. */
export function UserMenu({
  name,
  email,
  role,
  avatarUrl,
}: {
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-surface-muted"
        aria-label="Account menu"
      >
        <Avatar name={name} src={avatarUrl} size="sm" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <div className="px-3 py-2">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-xs text-foreground-muted">{email}</p>
          <Badge tone="neutral" size="sm" className="mt-1.5">
            {USER_ROLE_LABELS[role]}
          </Badge>
        </div>
        <DropdownMenuSeparator />
        {ACCOUNT_ITEMS.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href}>
              <item.icon />
              {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <button type="submit" form={LOGOUT_FORM_ID} className="w-full">
            <LogOut />
            Sign out
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const LOGOUT_FORM_ID = "buildlink-logout";

/**
 * Sign-out form.
 *
 * Signing out is a state change, so it is a POST to a server action rather than
 * a link — a GET would let a third-party page log the user out by embedding an
 * image. Rendered once per shell; the menu items submit it by `form` id.
 */
export function LogoutForm() {
  return <form id={LOGOUT_FORM_ID} action={logoutAction} className="hidden" />;
}
