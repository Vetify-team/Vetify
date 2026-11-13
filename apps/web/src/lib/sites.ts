/**
 * The three public sites served by this one Next.js app, each on its own
 * subdomain: the landing page, the owner app and the clinic app (which also
 * hosts the admin screens). Pure logic, no `next/*`, so the routing is tested
 * on its own.
 *
 * The URLs come from NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_OWNER_URL and
 * NEXT_PUBLIC_CLINIC_URL. When they are not set (local development, Vercel
 * preview URLs) every route is served on every host, as before.
 */

import type { UserRole } from "@vetify/types";

export type Site = "landing" | "owner" | "clinic";

export type SiteUrls = Partial<Record<Site, string>>;

/** Read at build time: Next.js inlines NEXT_PUBLIC_* variables. */
export const SITE_URLS: SiteUrls = {
  landing: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  owner: process.env.NEXT_PUBLIC_OWNER_URL || undefined,
  clinic: process.env.NEXT_PUBLIC_CLINIC_URL || undefined,
};

/** Vercel's production deployment; previews, staging and local are not. */
export const IS_PRODUCTION = process.env.VERCEL_ENV === "production";

/** The landing page's route; on the landing host it is served at "/". */
export const LANDING_PATH = "/inicio";

/** The landing site's other pages, served at their own path there. */
export const LANDING_PAGES = {
  clinics: "/clinicas",
  terms: "/terminos",
  /** User manuals; each guide lives under it (/ayuda/duenos, /ayuda/clinicas). */
  help: "/ayuda",
} as const;
const LANDING_PAGE_PATHS: string[] = Object.values(LANDING_PAGES);

/**
 * Pages of the owner site anyone may open. The install guide lives there:
 * only the owner and clinic sites can be installed, so the landing's
 * "Instalar" button sends visitors to it.
 */
export const OWNER_PAGES = { install: "/instalar" } as const;

/** A landing page or a page under one (the help guides). */
const isLandingPage = (path: string) => startsWithAny(path, LANDING_PAGE_PATHS);

const OWNER_PREFIXES = [
  "/mascotas",
  "/avisos",
  "/carne",
  "/esquema",
  "/ajustes",
  "/verificar",
  OWNER_PAGES.install,
];
const CLINIC_PREFIXES = [
  "/pacientes",
  "/carnes",
  "/vencidos",
  "/codigo",
  "/plan",
  "/equipo",
  "/invitacion",
  "/admin",
];

const startsWithAny = (path: string, prefixes: string[]) =>
  prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

const hostOf = (url: string | undefined): string | null => {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
};

/** The site a host serves, or null when it is not one of the configured sites. */
export function siteOfHost(host: string, urls: SiteUrls = SITE_URLS): Site | null {
  const sites: Site[] = ["landing", "owner", "clinic"];
  return sites.find((site) => hostOf(urls[site]) === host) ?? null;
}

/** The site a path belongs to; null for the pages every site shares. */
export function siteOfPath(path: string): Site | null {
  if (path === LANDING_PATH || isLandingPage(path)) return "landing";
  if (startsWithAny(path, OWNER_PREFIXES)) return "owner";
  if (startsWithAny(path, CLINIC_PREFIXES)) return "clinic";
  return null;
}

export type SiteRoute =
  | { type: "next" }
  | { type: "rewrite"; path: string }
  | { type: "redirect"; url: string };

/**
 * What the proxy does with a page request: serve it, serve the landing page
 * in its place, or send it to the site that owns it. `search` keeps the query
 * string on redirects; browsers keep the #fragment on their own.
 */
export function routeRequest(
  host: string,
  path: string,
  search = "",
  urls: SiteUrls = SITE_URLS,
): SiteRoute {
  const site = siteOfHost(host, urls);
  if (!site) return { type: "next" };

  const sendTo = (target: Site, targetPath: string): SiteRoute => {
    const base = urls[target];
    return base
      ? { type: "redirect", url: new URL(targetPath + search, base).toString() }
      : { type: "next" };
  };

  if (site === "landing") {
    if (path === "/") return { type: "rewrite", path: LANDING_PATH };
    if (path === LANDING_PATH) return sendTo("landing", "/");
    if (isLandingPage(path)) return { type: "next" };
    // Sign-in, sign-up and every app page live on the owner site.
    return sendTo("owner", path);
  }

  const owner = siteOfPath(path);
  if (owner === "landing") return sendTo("landing", path === LANDING_PATH ? "/" : path);
  if (owner && owner !== site) return sendTo(owner, path);
  return { type: "next" };
}

/** Home screen of each role. */
export const homeOf = (role: UserRole): string =>
  role === "owner" ? "/mascotas" : role === "clinic" ? "/pacientes" : "/admin/clinicas";

/**
 * Where a role's home is, seen from this host: a path here, or the absolute
 * URL of the site that serves it. A client-side navigation to another site's
 * path would hit the proxy's cross-origin redirect, fail and reload the
 * current page, which redirects again: a loop. That case needs a full load.
 */
export function homeTarget(
  role: UserRole,
  host: string,
  urls: SiteUrls = SITE_URLS,
): { type: "path"; path: string } | { type: "url"; url: string } {
  const path = homeOf(role);
  const route = routeRequest(host, path, "", urls);
  return route.type === "redirect"
    ? { type: "url", url: route.url }
    : { type: "path", path };
}

/**
 * A link to a page of another site: absolute when that site has its own URL,
 * relative (same host) otherwise.
 */
export function siteHref(site: Site, path = "/", urls: SiteUrls = SITE_URLS): string {
  const base = urls[site];
  return base
    ? new URL(path, base).toString()
    : site === "landing" && path === "/"
      ? LANDING_PATH
      : path;
}

/** Pages of the owner and clinic sites that search engines may show. */
const PUBLIC_APP_PATHS = ["/registro", "/iniciar-sesion", OWNER_PAGES.install];

/**
 * Whether search engines may index a page. Only production is indexed, and
 * there only the landing page and the sign-up and sign-in screens: the rest
 * of the apps needs a session and has nothing to show a crawler. Hosts that
 * are not a configured site (Vercel preview URLs) are never indexed.
 */
export function isIndexable(
  host: string,
  path: string,
  production: boolean,
  urls: SiteUrls = SITE_URLS,
): boolean {
  if (!production) return false;
  const site = siteOfHost(host, urls);
  if (site === "landing") return true;
  if (site === "owner" || site === "clinic") return PUBLIC_APP_PATHS.includes(path);
  return false;
}

/** Paths a site's robots.txt allows; an empty list disallows everything. */
export function robotsAllow(
  host: string,
  production: boolean,
  urls: SiteUrls = SITE_URLS,
) {
  if (!production) return [];
  const site = siteOfHost(host, urls);
  if (site === "landing") return ["/"];
  if (site === "owner" || site === "clinic") return PUBLIC_APP_PATHS;
  return [];
}

/**
 * The account type a site signs up, or null when one host serves both
 * (the wizard then asks).
 */
export function signUpRoleOf(site: Site | null): "owner" | "clinic" | null {
  return site === "owner" || site === "clinic" ? site : null;
}
