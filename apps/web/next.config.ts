import type { NextConfig } from "next";

/** Where the Vetify API runs. Server-side only: the browser never sees it. */
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:3001";

/**
 * Headers for every response. The Content-Security-Policy is set per request
 * in src/proxy.ts because it carries a nonce.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  agentRules: false,
  devIndicators: false,
  poweredByHeader: false,
  transpilePackages: ["@vetify/types"],
  // Images are not optimized by the server: the app does not use next/image
  // and this closes the image optimizer as an SSRF surface.
  images: { unoptimized: true },

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },

  /**
   * The browser calls the API on this same origin (/api/...). Next forwards
   * it to the API server, so the session cookie is first-party and
   * SameSite=Strict, and the CSP can keep connect-src at 'self'.
   */
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` }];
  },
};

export default nextConfig;
