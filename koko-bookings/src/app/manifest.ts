import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/config";

/**
 * Installable-app metadata. The shell is installable on a phone; booking and
 * payment always talk to the server, so nothing is served stale from a cache.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name} — Lash Appointments`,
    short_name: "Koko's",
    description:
      "Book your lash appointment in seconds and secure it with a K50 deposit.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fffcfd",
    theme_color: "#de6b8e",
    categories: ["beauty", "lifestyle", "business"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Book an appointment", url: "/book" },
      { name: "Manage my booking", url: "/my-booking" },
    ],
  };
}
