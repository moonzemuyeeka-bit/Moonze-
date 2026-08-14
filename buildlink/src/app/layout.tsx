import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "BuildLink Zambia — Build Better. Buy Smarter.",
    template: "%s · BuildLink Zambia",
  },
  description:
    "BuildLink Zambia connects people building or renovating with building-material suppliers, delivery providers and construction professionals. Compare prices in Kwacha, order materials, arrange delivery and track your construction budget in one place.",
  applicationName: "BuildLink Zambia",
  keywords: [
    "building materials Zambia",
    "cement prices Zambia",
    "construction marketplace",
    "Lusaka building suppliers",
    "bricks blocks Zambia",
    "construction budget tracker",
  ],
  authors: [{ name: "BuildLink Zambia" }],
  openGraph: {
    type: "website",
    siteName: "BuildLink Zambia",
    title: "BuildLink Zambia — Build Better. Buy Smarter.",
    description:
      "Everything you need to build your home, connected in one place. Compare suppliers, buy materials, arrange delivery and track your budget.",
    locale: "en_ZM",
  },
  robots: { index: true, follow: true },
  formatDetection: { telephone: true, address: false, email: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#146041",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZM" className={inter.variable}>
      <body className="min-h-dvh bg-background font-sans antialiased">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
