import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  devIndicators: false,
  transpilePackages: ["@vetify/types"],
};

export default nextConfig;
