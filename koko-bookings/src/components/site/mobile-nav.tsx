"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarPlus, Home, TicketCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/book", label: "Book", Icon: CalendarPlus },
  { href: "/my-booking", label: "My booking", Icon: TicketCheck },
];

/**
 * Bottom navigation for phones. Hidden on the booking flow itself, where the
 * sticky booking summary owns the bottom of the screen.
 */
export function MobileNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/book")) return null;

  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-[0.7rem] font-medium transition-colors",
                  active ? "text-blush-700" : "text-ink-muted",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
