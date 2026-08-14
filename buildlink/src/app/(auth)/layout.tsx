import Link from "next/link";
import { BadgeCheck, Scale, TrendingDown, Truck } from "lucide-react";
import { Logo } from "@/components/brand/logo";

const REASONS = [
  {
    icon: Scale,
    title: "Compare before you buy",
    body: "See what cement, blocks, sand and roofing actually cost across suppliers near you.",
  },
  {
    icon: TrendingDown,
    title: "Keep the budget honest",
    body: "Every order posts itself against your project budget, so remaining funds are always current.",
  },
  {
    icon: Truck,
    title: "Get it to site",
    body: "Arrange supplier or third-party delivery and follow it from the yard to your plot.",
  },
  {
    icon: BadgeCheck,
    title: "Know who you are dealing with",
    body: "Verification status and trust scores are shown plainly — never implied.",
  },
] as const;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:grid lg:grid-cols-[1fr_1.1fr]">
      {/* Brand panel — hidden on phones, where the form is all that matters. */}
      <aside className="hidden bg-brand-900 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="inline-flex w-fit rounded-md" aria-label="BuildLink Zambia home">
          <span className="flex items-center gap-2.5">
            <span className="text-2xl font-semibold tracking-tight">
              BuildLink<span className="text-gold-400"> Zambia</span>
            </span>
          </span>
        </Link>

        <div className="space-y-8">
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight">
              Build Better.
              <br />
              Buy Smarter.
            </h2>
            <p className="max-w-md text-brand-100">
              Zambia&apos;s construction marketplace: materials, suppliers, delivery and budget
              tracking in one place, priced in Kwacha.
            </p>
          </div>

          <ul className="space-y-5">
            {REASONS.map((reason) => (
              <li key={reason.title} className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <reason.icon aria-hidden className="size-4.5 text-gold-400" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{reason.title}</p>
                  <p className="text-sm text-brand-100">{reason.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-brand-200">
          BuildLink records payments between customers and suppliers. It does not hold or transmit
          funds.
        </p>
      </aside>

      <main id="main-content" className="flex flex-1 flex-col">
        <div className="border-b border-border p-4 lg:hidden">
          <Logo />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
          <div className="w-full max-w-lg">{children}</div>
        </div>
      </main>
    </div>
  );
}
