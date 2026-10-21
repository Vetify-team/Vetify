import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Geist_Mono, Lora } from "next/font/google";
import { headers } from "next/headers";
import { Providers } from "@/components/providers";
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

export const metadata: Metadata = {
  title: "Vetify",
  description:
    "Expediente clínico compartido de mascotas: propiedad del dueño, alimentado por el dueño y las clínicas veterinarias.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Vetify",
  },
};

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
