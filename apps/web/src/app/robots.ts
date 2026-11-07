import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { IS_PRODUCTION, robotsAllow, siteHref } from "@/lib/sites";

/** Per-host robots.txt: see `robotsAllow` in lib/sites. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host") ?? "";
  const allow = robotsAllow(host, IS_PRODUCTION);
  if (allow.length === 0) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow, ...(allow.includes("/") ? {} : { disallow: "/" }) },
    sitemap: siteHref("landing", "/sitemap.xml"),
  };
}
