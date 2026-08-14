import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { BRAND } from "@/lib/config";

export function SiteFooter({
  businessName,
  businessPhone,
  businessEmail,
}: {
  businessName: string;
  businessPhone: string;
  businessEmail: string;
}) {
  return (
    <footer className="mt-16 border-t border-line bg-white/60">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
        <div className="space-y-2">
          <p className="font-display text-lg text-ink">{businessName}</p>
          <p className="text-sm text-ink-soft">{BRAND.tagline}</p>
        </div>

        <div className="space-y-2 text-sm">
          <p className="font-medium text-ink">Visit &amp; contact</p>
          <p className="flex items-center gap-2 text-ink-soft">
            <MapPin className="size-4 text-blush-500" aria-hidden />
            {BRAND.city}
          </p>
          <p className="flex items-center gap-2 text-ink-soft">
            <Phone className="size-4 text-blush-500" aria-hidden />
            <a className="hover:text-blush-700" href={`tel:${businessPhone.replace(/\s/g, "")}`}>
              {businessPhone}
            </a>
          </p>
          <p className="flex items-center gap-2 text-ink-soft">
            <Mail className="size-4 text-blush-500" aria-hidden />
            <a className="hover:text-blush-700" href={`mailto:${businessEmail}`}>
              {businessEmail}
            </a>
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <p className="font-medium text-ink">Bookings</p>
          <ul className="space-y-2 text-ink-soft">
            <li>
              <Link className="hover:text-blush-700" href="/book">
                Book an appointment
              </Link>
            </li>
            <li>
              <Link className="hover:text-blush-700" href="/my-booking">
                Manage my booking
              </Link>
            </li>
            <li>
              <Link className="hover:text-blush-700" href="/policy">
                Booking &amp; deposit policy
              </Link>
            </li>
            <li>
              <Link className="hover:text-blush-700" href="/admin">
                Business sign in
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line px-4 py-5 text-center text-xs text-ink-muted sm:px-6">
        © {new Date().getFullYear()} {businessName}. Prices in Zambian Kwacha (ZMW).
      </div>
    </footer>
  );
}
