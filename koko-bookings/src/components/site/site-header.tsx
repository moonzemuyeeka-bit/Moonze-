import Link from "next/link";
import { CalendarHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/config";

export function SiteHeader({ businessName }: { businessName?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-cream/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-full py-1 pr-2 text-left"
          aria-label={`${businessName ?? BRAND.name} home`}
        >
          <span className="flex size-9 items-center justify-center rounded-2xl bg-linear-to-br from-blush-500 to-blush-700 text-white shadow-soft">
            <CalendarHeart className="size-5" aria-hidden />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-base text-ink sm:text-lg">
              {businessName ?? BRAND.name}
            </span>
            <span className="block text-[0.7rem] uppercase tracking-[0.14em] text-ink-muted">
              Lash studio · Lusaka
            </span>
          </span>
        </Link>

        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/#services">Services</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/my-booking">My booking</Link>
          </Button>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/book">Book now</Link>
          </Button>
          <Button asChild size="sm" variant="subtle" className="sm:hidden">
            <Link href="/book">Book</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
