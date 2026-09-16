import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Evita que `next dev` reescriba nuestro CLAUDE.md con notas genéricas
  // para agentes de IA.
  agentRules: false,
  transpilePackages: ["@vetify/types"],
};

export default nextConfig;
