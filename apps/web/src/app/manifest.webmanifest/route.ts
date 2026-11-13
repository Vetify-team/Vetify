import { manifestFor } from "@/lib/manifest";
import { siteOfHost } from "@/lib/sites";

/**
 * The web app manifest of the site the request came to (see lib/manifest):
 * the owner's app on app., the clinic's on clinica., none on the landing.
 * Per host, so it is rendered on each request.
 */
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const host = request.headers.get("host") ?? new URL(request.url).host;
  const manifest = manifestFor(siteOfHost(host));
  if (!manifest) return new Response("Not found", { status: 404 });
  return Response.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      // Per host: a shared cache must not serve one site's manifest to another.
      "Cache-Control": "public, max-age=3600",
      Vary: "Host",
    },
  });
}
