import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Geist_Mono, Lora } from "next/font/google";
import { headers } from "next/headers";
import { Providers } from "@/components/providers";
import { installsAs } from "@/lib/manifest";
import { SITE_URLS, siteOfHost } from "@/lib/sites";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

/** Titles and labels. */
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

/** Body text. */
const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION =
  "Vetify es el expediente clínico de tu mascota: vacunas, consultas y carné digital con QR en un solo lugar. El expediente es del dueño y las clínicas veterinarias de Costa Rica lo completan con su permiso.";

const BASE_METADATA: Metadata = {
  // Absolute URLs (Open Graph, canonical) point to the landing site.
  metadataBase: SITE_URLS.landing ? new URL(SITE_URLS.landing) : undefined,
  title: { default: "Vetify", template: "%s · Vetify" },
  description: DESCRIPTION,
  applicationName: "Vetify",
  keywords: [
    "Vetify",
    "expediente clínico de mascotas",
    "carné de vacunación digital",
    "vacunas de perros y gatos",
    "veterinaria Costa Rica",
    "historial médico de mascotas",
  ],
  openGraph: {
    type: "website",
    siteName: "Vetify",
    locale: "es_CR",
    title: "Vetify — El expediente de tu mascota, siempre con vos",
    description: DESCRIPTION,
    url: "/",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vetify — El expediente de tu mascota, siempre con vos",
    description: DESCRIPTION,
    images: ["/opengraph-image"],
  },
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon-192.png" },
};

/**
 * Only the owner and clinic sites link a manifest and open as an app from
 * the iPhone's home screen; the landing is a plain website (lib/manifest).
 */
export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get("host") ?? "";
  const app = installsAs(siteOfHost(host));
  if (!app) return BASE_METADATA;
  return {
    ...BASE_METADATA,
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: app === "clinic" ? "Vetify Clínica" : "Vetify",
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4efe5" },
    { media: "(prefers-color-scheme: dark)", color: "#121110" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Per-request CSP nonce set by src/proxy.ts; the inline theme script needs it.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    // The theme is applied before paint (script below), so the <html> class
    // may differ from the server render on purpose.
    <html
      lang="es"
      suppressHydrationWarning
      className={`${cormorant.variable} ${lora.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
