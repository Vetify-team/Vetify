import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Evita que `next dev` reescriba nuestro CLAUDE.md con notas genéricas
  // para agentes de IA.
  agentRules: false,
};

const isDev = process.env.NODE_ENV === "development";

// next-pwa inyecta una config de webpack, incompatible con Turbopack
// (dev, y build sin el flag --webpack). En dev el service worker no
// se genera de todas formas, así que ahí se omite el wrapper.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: isDev,
});

export default isDev ? nextConfig : withPWA(nextConfig);
