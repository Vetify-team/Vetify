import type { MetadataRoute } from "next";
import type { Site } from "./sites";

/**
 * Which app a host installs. Only the owner and clinic sites are apps; the
 * landing is a website and has no manifest, so browsers do not offer to
 * install it (its "Instalar" button leads to the owner site's guide). A host
 * that is not a configured site (local development, Vercel previews) serves
 * every page, and installs as the owner app, as before. Pure logic: tested on
 * its own.
 */
export function installsAs(site: Site | null): "owner" | "clinic" | null {
  if (site === "landing") return null;
  return site === "clinic" ? "clinic" : "owner";
}

const ICONS: MetadataRoute.Manifest["icons"] = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  {
    src: "/icons/icon-maskable-512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "maskable",
  },
  { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
];

/** Paper, the same as the page background and the theme color. */
const PAPER = "#f4efe5";

/** The web app manifest of the site, or null for the landing. */
export function manifestFor(site: Site | null): MetadataRoute.Manifest | null {
  const app = installsAs(site);
  if (!app) return null;
  const common = {
    display: "standalone",
    lang: "es",
    dir: "ltr",
    background_color: PAPER,
    theme_color: PAPER,
    icons: ICONS,
    // The whole host is the app: each site is its own origin.
    scope: "/",
  } satisfies MetadataRoute.Manifest;
  return app === "owner"
    ? {
        ...common,
        id: "/mascotas",
        name: "Vetify",
        short_name: "Vetify",
        description:
          "El expediente clínico de tu mascota: vacunas, consultas, peso y carné digital con QR.",
        start_url: "/mascotas",
        orientation: "portrait",
      }
    : {
        ...common,
        id: "/pacientes",
        name: "Vetify Clínica",
        short_name: "Vetify Clínica",
        description:
          "Portal de la clínica: pacientes con permiso del dueño, esquemas vencidos y carnés.",
        start_url: "/pacientes",
        // Clinics use it on computers and tablets too.
        orientation: "any",
      };
}
