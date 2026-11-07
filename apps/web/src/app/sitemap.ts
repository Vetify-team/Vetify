import type { MetadataRoute } from "next";
import { SITE_URLS, siteHref } from "@/lib/sites";

/**
 * The public pages, across the landing, owner and clinic sites (one Search
 * Console domain property covers all of them). Empty when the sites have no
 * URLs of their own.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!SITE_URLS.landing) return [];
  const page = (url: string, priority: number): MetadataRoute.Sitemap[number] => ({
    url,
    changeFrequency: "monthly",
    priority,
  });
  return [
    page(siteHref("landing", "/"), 1),
    ...(SITE_URLS.owner ? [page(siteHref("owner", "/registro"), 0.6)] : []),
    ...(SITE_URLS.clinic ? [page(siteHref("clinic", "/registro"), 0.5)] : []),
  ];
}
