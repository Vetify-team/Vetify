import type { MetadataRoute } from "next";
import { LANDING_PAGES, OWNER_PAGES, SITE_URLS, siteHref } from "@/lib/sites";

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
    page(siteHref("landing", LANDING_PAGES.clinics), 0.7),
    page(siteHref("landing", LANDING_PAGES.terms), 0.3),
    page(siteHref("landing", LANDING_PAGES.help), 0.6),
    page(siteHref("landing", `${LANDING_PAGES.help}/duenos`), 0.6),
    page(siteHref("landing", `${LANDING_PAGES.help}/clinicas`), 0.6),
    ...(SITE_URLS.owner
      ? [
          page(siteHref("owner", OWNER_PAGES.install), 0.7),
          page(siteHref("owner", "/registro"), 0.6),
        ]
      : []),
    ...(SITE_URLS.clinic ? [page(siteHref("clinic", "/registro"), 0.5)] : []),
  ];
}
