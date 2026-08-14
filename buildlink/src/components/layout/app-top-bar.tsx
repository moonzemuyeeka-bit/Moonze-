"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, Search, ShoppingCart } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserMenu, type NavCounts } from "@/components/layout/app-nav";
import type { UserRole } from "@prisma/client";

/**
 * Application top bar.
 *
 * The marketplace search box lives here so it is reachable from every screen —
 * "where can I get it?" is the question customers arrive with most often. It is
 * a real form with a `q` field, so search works before JavaScript loads and the
 * result page stays shareable.
 */
export function AppTopBar({
  user,
  counts,
  avatarUrl,
}: {
  user: { name: string; email: string; role: UserRole } | null;
  counts: NavCounts;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(searchParams.get("q") ?? "");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/marketplace?q=${encodeURIComponent(trimmed)}` : "/marketplace");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <div className="lg:hidden">
          <Logo size="sm" />
        </div>

        <form
          onSubmit={handleSubmit}
          role="search"
          className="relative min-w-0 flex-1 lg:max-w-xl"
          action="/marketplace"
          method="get"
        >
          <label htmlFor="global-search" className="sr-only">
            Search building materials
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-subtle"
          />
          <Input
            id="global-search"
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search cement, blocks, roofing…"
            className="h-10 pl-9"
            autoComplete="off"
          />
        </form>

        <div className="flex shrink-0 items-center gap-1">
          <Button asChild variant="ghost" size="icon-sm" className="relative">
            <Link href="/cart" aria-label={`Cart, ${counts.cart} item${counts.cart === 1 ? "" : "s"}`}>
              <ShoppingCart />
              {counts.cart > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-gold-500 text-[0.5625rem] font-bold text-ink-950">
                  {counts.cart > 9 ? "9+" : counts.cart}
                </span>
              ) : null}
            </Link>
          </Button>

          {user ? (
            <>
              <Button asChild variant="ghost" size="icon-sm" className="relative hidden sm:inline-flex">
                <Link
                  href="/notifications"
                  aria-label={`Notifications, ${counts.notifications} unread`}
                >
                  <Bell />
                  {counts.notifications > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-danger-500 text-[0.5625rem] font-bold text-white">
                      {counts.notifications > 9 ? "9+" : counts.notifications}
                    </span>
                  ) : null}
                </Link>
              </Button>
              <div className="hidden lg:block">
                <UserMenu
                  name={user.name}
                  email={user.email}
                  role={user.role}
                  avatarUrl={avatarUrl}
                />
              </div>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
