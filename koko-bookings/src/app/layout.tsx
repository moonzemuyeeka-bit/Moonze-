import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { BRAND } from "@/lib/config";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${BRAND.name} | Book Your Lash Appointment`,
    template: `%s | ${BRAND.name}`,
  },
  description:
    "Book classic, natural, manga, wet or volume lash sets in Lusaka. Pick your time and secure your appointment with a K50 deposit paid by Mobile Money or bank card.",
  keywords: [
    "lash appointments Lusaka",
    "eyelash extensions Zambia",
    "classic lashes",
    "volume lashes",
    "lash booking Zambia",
  ],
  applicationName: BRAND.name,
  authors: [{ name: BRAND.name }],
  openGraph: {
    type: "website",
    title: `${BRAND.name} | Book Your Lash Appointment`,
    description:
      "Choose your look, pick your perfect time, and secure your appointment with a K50 deposit.",
    siteName: BRAND.name,
    locale: "en_ZM",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} | Book Your Lash Appointment`,
    description:
      "Choose your look, pick your perfect time, and secure your appointment with a K50 deposit.",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: "default" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#de6b8e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-ZM" className={`${inter.variable} ${playfair.variable}`}>
      <body className="font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-blush-700 focus:shadow-card"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
