import { NextResponse, type NextRequest } from "next/server";

/**
 * Content Security Policy with a fresh nonce per request. Only scripts that
 * carry the nonce run (Next.js adds it to its own, the layout to the theme
 * script), so an injected <script> is inert even if it reaches the page.
 *
 * - connect-src 'self': the browser only talks to this origin; the API is
 *   reached through the /api rewrite.
 * - style-src 'unsafe-inline': Next.js and some libraries inject <style>
 *   tags without a nonce, and a nonce would make browsers ignore
 *   'unsafe-inline'. Styles cannot execute code; scripts stay nonce-only.
 * - 'unsafe-eval' only in development (React's dev tooling needs it).
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const dev = process.env.NODE_ENV === "development";

  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not the API rewrite, static files or the service worker.
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|sw.js|swe-worker|icons|manifest.webmanifest).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
