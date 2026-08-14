import Link from "next/link";
import {
  BadgeCheck,
  CalendarCheck,
  CreditCard,
  Heart,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { ServiceShowcase } from "@/components/site/service-showcase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BRAND } from "@/lib/config";
import { listActiveServices } from "@/lib/database/services";
import { getBusinessConfig, policyParagraphs } from "@/lib/database/settings";
import { formatKwacha } from "@/lib/money";

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const STEPS = [
  {
    title: "Choose your set",
    description: "Classic, natural, manga, wet or volume — with prices up front.",
    Icon: Sparkles,
  },
  {
    title: "Pick a time",
    description: "Live availability, so you only ever see times that are truly open.",
    Icon: CalendarCheck,
  },
  {
    title: "Secure it",
    description: "Pay the deposit with Mobile Money or a bank card in seconds.",
    Icon: Smartphone,
  },
  {
    title: "Get confirmed",
    description: "Your reference and appointment details arrive straight away.",
    Icon: BadgeCheck,
  },
];

export default async function HomePage() {
  const [services, config] = await Promise.all([
    listActiveServices(),
    getBusinessConfig(),
  ]);

  const featured = services.filter((service) => service.featured).slice(0, 4);
  const depositLabel = formatKwacha(config.depositNgwee);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      {/* Hero */}
      <section className="animate-fade-up py-10 sm:py-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full border border-blush-200 bg-white/70 px-3.5 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-blush-700">
              <Heart className="size-3.5" aria-hidden />
              {BRAND.city}
            </p>

            <h1 className="font-display text-4xl leading-[1.08] text-ink sm:text-5xl lg:text-6xl">
              Beautiful lashes.
              <br />
              <span className="bg-linear-to-r from-blush-600 to-blush-800 bg-clip-text text-transparent">
                Booked in seconds.
              </span>
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
              Choose your look, pick your perfect time, and secure your appointment with a{" "}
              {depositLabel} deposit.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="sm:w-auto" full>
                <Link href="/book">Book an Appointment</Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="sm:w-auto" full>
                <Link href="/my-booking">Manage My Booking</Link>
              </Button>
            </div>

            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-mint-500" aria-hidden />
                {depositLabel} deposit secures your slot
              </li>
              <li className="flex items-center gap-1.5">
                <Smartphone className="size-4 text-mint-500" aria-hidden />
                Airtel, MTN &amp; Zamtel wallets
              </li>
              <li className="flex items-center gap-1.5">
                <CreditCard className="size-4 text-mint-500" aria-hidden />
                Visa &amp; Mastercard
              </li>
            </ul>
          </div>

          {/* Popular services preview */}
          <Card className="animate-fade-up bg-white/80">
            <CardContent className="space-y-4 p-6 pt-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl text-ink">Most booked</h2>
                <span className="text-xs uppercase tracking-[0.14em] text-ink-muted">
                  From {formatKwacha(Math.min(...services.map((s) => s.priceNgwee)))}
                </span>
              </div>

              <ul className="divide-y divide-line">
                {featured.map((service) => (
                  <li key={service.id} className="flex items-center justify-between gap-3 py-3">
                    <span className="flex items-center gap-2 text-sm text-ink">
                      <Sparkles className="size-4 text-blush-400" aria-hidden />
                      {service.name}
                    </span>
                    <span className="text-sm font-semibold text-blush-800">
                      {service.priceLabel}
                    </span>
                  </li>
                ))}
              </ul>

              <Button asChild full>
                <Link href="/book">Start booking</Link>
              </Button>
              <p className="text-center text-xs text-ink-muted">
                Takes about a minute · No account needed
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="scroll-mt-20 py-8 sm:py-12">
        <div className="mb-6 space-y-2">
          <h2 className="font-display text-3xl text-ink">Our lash services</h2>
          <p className="max-w-2xl text-ink-soft">
            Every price is in Zambian Kwacha and includes a patch of aftercare advice.
            The {depositLabel} deposit comes off your total on the day.
          </p>
        </div>
        <ServiceShowcase services={services} />
      </section>

      {/* How it works */}
      <section className="py-8 sm:py-12">
        <h2 className="mb-6 font-display text-3xl text-ink">How booking works</h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <Card className="h-full">
                <CardContent className="space-y-3 p-5 pt-5">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-2xl bg-blush-100 text-blush-700">
                      <step.Icon className="size-5" aria-hidden />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
                      Step {index + 1}
                    </span>
                  </div>
                  <h3 className="font-display text-lg text-ink">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-ink-soft">{step.description}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* Policy + hours */}
      <section className="grid gap-4 py-8 sm:py-12 lg:grid-cols-2">
        <Card className="bg-white/80">
          <CardContent className="space-y-3 p-6 pt-6">
            <h2 className="font-display text-2xl text-ink">Booking deposit policy</h2>
            <ul className="space-y-2 text-sm leading-relaxed text-ink-soft">
              {policyParagraphs(config).map((paragraph) => (
                <li key={paragraph} className="flex gap-2">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-blush-500" aria-hidden />
                  <span>{paragraph}</span>
                </li>
              ))}
            </ul>
            <Button asChild variant="link" className="px-0">
              <Link href="/policy">Read the full policy</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-white/80">
          <CardContent className="space-y-3 p-6 pt-6">
            <h2 className="font-display text-2xl text-ink">Opening hours</h2>
            <ul className="divide-y divide-line text-sm">
              {config.workingHours.map((day) => (
                <li key={day.dayOfWeek} className="flex items-center justify-between py-2">
                  <span className="text-ink">{WEEKDAY_NAMES[day.dayOfWeek]}</span>
                  <span className={day.closed ? "text-ink-muted" : "font-medium text-ink"}>
                    {day.closed ? "Closed" : `${day.openTime}–${day.closeTime}`}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-ink-muted">
              Appointments include a {config.bufferMinutes}-minute reset between clients,
              so you are never rushed.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
