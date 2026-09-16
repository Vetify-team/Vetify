import type { MetadataRoute } from "next";

/**
 * Manifest de la PWA generado por Next.js (se sirve en /manifest.webmanifest).
 * Se prefiere sobre un JSON estático para que los textos y la paleta vivan en
 * un solo lugar tipado.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vetify — Expediente clínico de mascotas",
    short_name: "Vetify",
    description:
      "Expediente clínico compartido de mascotas: propiedad del dueño, alimentado por el dueño y las clínicas veterinarias.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "es",
    background_color: "#FAF6EC",
    theme_color: "#1B5540",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
