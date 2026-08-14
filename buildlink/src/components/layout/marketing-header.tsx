"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/marketplace/suppliers", label: "Suppliers" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/suppliers", label: "For suppliers" },
] as const;

/**
 * Public site header.
 *
 * The mobile menu is a plain disclosure rather than a modal: it keeps the page
 * scrollable behind it, needs no focus trap, and works if JavaScript is slow to
 * arrive on a weak connection.
 */
export function MarketingHeader({ isSignedIn, homePath }: { isSignedIn: boolean; homePath: string }) {
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {isSignedIn ? (
            <Button asChild variant="primary" size="sm">
              <Link href={homePath}>Go to dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild variant="primary" size="sm">
                <Link href="/register">Start building</Link>
              </Button>
            </>
          )}
        </div>

        <Button
          variant="outline"
          size="icon-sm"
          className="lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>

      {open ? (
        <div id="mobile-menu" className="border-t border-border bg-surface lg:hidden">
          <nav aria-label="Main" className="mx-auto max-w-7xl space-y-1 px-4 py-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-surface-muted"
              >
                {link.label}
              </Link>
            ))}
            <div className="flex flex-col gap-2 pt-2">
              {isSignedIn ? (
                <Button asChild block>
                  <Link href={homePath}>Go to dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button asChild variant="outline" block>
                    <Link href="/login">Sign in</Link>
                  </Button>
                  <Button asChild block>
                    <Link href="/register">Start building</Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
