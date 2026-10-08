import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Geist_Mono, Lora } from "next/font/google";
import { Proveedores } from "@/components/proveedores";
import { SCRIPT_TEMA } from "@/lib/tema";
import "./globals.css";

/** Títulos y rótulos. */
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

/** Cuerpo de texto. */
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // El tema se aplica antes de pintar (script de abajo), así que la clase
    // del <html> puede diferir del render del servidor a propósito.
    <html
      lang="es"
      suppressHydrationWarning
      className={`${cormorant.variable} ${lora.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Proveedores>{children}</Proveedores>
      </body>
    </html>
  );
}
