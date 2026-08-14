"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  CalendarRange,
  CreditCard,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/admin/calendar", label: "Calendar", Icon: CalendarRange },
  { href: "/admin/bookings", label: "Bookings", Icon: ListChecks },
  { href: "/admin/services", label: "Services", Icon: Sparkles },
  { href: "/admin/customers", label: "Customers", Icon: Users },
  { href: "/admin/payments", label: "Payments", Icon: CreditCard },
  { href: "/admin/settings", label: "Settings", Icon: Settings },
];

/**
 * Admin chrome: a rail on desktop, a scrollable tab strip on a phone so the
 * owner can check the day between clients.
 */
export function AdminShell({
  businessName,
  adminName,
  children,
}: {
  businessName: string;
  adminName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await apiRequest("/api/admin/session", { method: "DELETE" });
      router.push("/admin/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="hidden w-64 shrink-0 border-r border-line bg-white/70 lg:flex lg:flex-col">
        <div className="border-b border-line p-5">
          <p className="font-display text-lg text-ink">{businessName}</p>
          <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">
            Business dashboard
          </p>
        </div>

        <nav aria-label="Admin" className="flex-1 space-y-1 p-3">
          {NAV.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} />
          ))}
        </nav>

        <div className="space-y-2 border-t border-line p-4">
          <p className="text-sm text-ink">Signed in as {adminName}</p>
          <Button
            variant="secondary"
            size="sm"
            full
            loading={signingOut}
            loadingText="Signing out…"
            onClick={signOut}
          >
            <LogOut aria-hidden />
            Sign out
          </Button>
          <Button asChild variant="ghost" size="sm" full>
            <Link href="/">View customer site</Link>
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-cream/90 backdrop-blur-md lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-display text-base text-ink">{businessName}</p>
              <p className="text-[0.7rem] uppercase tracking-[0.14em] text-ink-muted">
                Dashboard
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={signOut} loading={signingOut}>
              <LogOut aria-hidden />
              Sign out
            </Button>
          </div>

          <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-2">
            {NAV.map((item) => (
              <NavLink key={item.href} {...item} pathname={pathname} compact />
            ))}
          </nav>
        </header>

        <main id="main" className="min-w-0 flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavLink({
  href,
  label,
  Icon,
  pathname,
  compact = false,
}: {
  href: string;
  label: string;
  Icon: typeof LayoutDashboard;
  pathname: string;
  compact?: boolean;
}) {
  const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-2xl text-sm font-medium transition-colors",
        compact ? "shrink-0 px-3 py-2" : "px-3 py-2.5",
        active
          ? "bg-blush-100 text-blush-800"
          : "text-ink-soft hover:bg-blush-50 hover:text-blush-700",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}
