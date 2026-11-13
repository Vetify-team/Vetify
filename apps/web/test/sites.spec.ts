import { describe, expect, it } from "vitest";
import {
  homeTarget,
  isIndexable,
  robotsAllow,
  routeRequest,
  signUpRoleOf,
  siteHref,
  siteOfHost,
  siteOfPath,
  type SiteUrls,
} from "../src/lib/sites";

const urls: SiteUrls = {
  landing: "https://www.vetify.live",
  owner: "https://app.vetify.live",
  clinic: "https://clinica.vetify.live",
};

describe("sites", () => {
  it("knows which site a host serves", () => {
    expect(siteOfHost("www.vetify.live", urls)).toBe("landing");
    expect(siteOfHost("app.vetify.live", urls)).toBe("owner");
    expect(siteOfHost("clinica.vetify.live", urls)).toBe("clinic");
    expect(siteOfHost("vetify-git-dev.vercel.app", urls)).toBeNull();
    expect(siteOfHost("localhost:3000", {})).toBeNull();
  });

  it("knows which site a path belongs to", () => {
    expect(siteOfPath("/mascotas/abc/carne")).toBe("owner");
    expect(siteOfPath("/verificar")).toBe("owner");
    expect(siteOfPath("/pacientes")).toBe("clinic");
    expect(siteOfPath("/admin/clinicas")).toBe("clinic");
    expect(siteOfPath("/escanear")).toBe("clinic");
    expect(siteOfPath("/inicio")).toBe("landing");
    expect(siteOfPath("/instalar")).toBe("owner");
    expect(siteOfPath("/clinicas")).toBe("landing");
    expect(siteOfPath("/terminos")).toBe("landing");
    expect(siteOfPath("/iniciar-sesion")).toBeNull();
    expect(siteOfPath("/registro")).toBeNull();
    // A prefix only matches whole segments.
    expect(siteOfPath("/mascotasx")).toBeNull();
  });

  it("serves the landing page at the root of the landing host", () => {
    expect(routeRequest("www.vetify.live", "/", "", urls)).toEqual({
      type: "rewrite",
      path: "/inicio",
    });
    expect(routeRequest("www.vetify.live", "/inicio", "", urls)).toEqual({
      type: "redirect",
      url: "https://www.vetify.live/",
    });
  });

  it("serves the install guide on the owner site, the one that installs", () => {
    expect(routeRequest("app.vetify.live", "/instalar", "", urls)).toEqual({
      type: "next",
    });
    expect(routeRequest("www.vetify.live", "/instalar", "?a=1", urls)).toEqual({
      type: "redirect",
      url: "https://app.vetify.live/instalar?a=1",
    });
    expect(routeRequest("clinica.vetify.live", "/instalar", "", urls)).toEqual({
      type: "redirect",
      url: "https://app.vetify.live/instalar",
    });
    expect(siteHref("owner", "/instalar", urls)).toBe("https://app.vetify.live/instalar");
  });

  it("serves the clinic page on the landing host", () => {
    expect(routeRequest("www.vetify.live", "/clinicas", "", urls)).toEqual({
      type: "next",
    });
    expect(routeRequest("clinica.vetify.live", "/clinicas", "", urls)).toEqual({
      type: "redirect",
      url: "https://www.vetify.live/clinicas",
    });
  });

  it("sends app pages on the landing host to the owner site", () => {
    expect(routeRequest("www.vetify.live", "/iniciar-sesion", "?x=1", urls)).toEqual({
      type: "redirect",
      url: "https://app.vetify.live/iniciar-sesion?x=1",
    });
  });

  it("keeps owner and clinic pages on their own site", () => {
    expect(routeRequest("app.vetify.live", "/mascotas", "", urls)).toEqual({
      type: "next",
    });
    expect(routeRequest("app.vetify.live", "/pacientes", "", urls)).toEqual({
      type: "redirect",
      url: "https://clinica.vetify.live/pacientes",
    });
    expect(routeRequest("clinica.vetify.live", "/avisos", "", urls)).toEqual({
      type: "redirect",
      url: "https://app.vetify.live/avisos",
    });
    expect(routeRequest("clinica.vetify.live", "/iniciar-sesion", "", urls)).toEqual({
      type: "next",
    });
    expect(routeRequest("clinica.vetify.live", "/inicio", "", urls)).toEqual({
      type: "redirect",
      url: "https://www.vetify.live/",
    });
  });

  it("serves everything on hosts that are not configured", () => {
    expect(routeRequest("localhost:3000", "/pacientes", "", {})).toEqual({
      type: "next",
    });
    expect(routeRequest("vetify-liart.vercel.app", "/", "", urls)).toEqual({
      type: "next",
    });
  });

  it("builds links to other sites", () => {
    expect(siteHref("clinic", "/registro", urls)).toBe(
      "https://clinica.vetify.live/registro",
    );
    expect(siteHref("clinic", "/registro", {})).toBe("/registro");
    expect(siteHref("landing", "/", {})).toBe("/inicio");
  });

  it("fixes the sign-up role on the owner and clinic sites", () => {
    expect(signUpRoleOf("owner")).toBe("owner");
    expect(signUpRoleOf("clinic")).toBe("clinic");
    expect(signUpRoleOf("landing")).toBeNull();
    expect(signUpRoleOf(null)).toBeNull();
  });

  it("lets search engines index only the public production pages", () => {
    expect(isIndexable("www.vetify.live", "/", true, urls)).toBe(true);
    expect(isIndexable("app.vetify.live", "/registro", true, urls)).toBe(true);
    expect(isIndexable("clinica.vetify.live", "/iniciar-sesion", true, urls)).toBe(true);
    expect(isIndexable("app.vetify.live", "/mascotas", true, urls)).toBe(false);
    expect(isIndexable("www.vetify.live", "/", false, urls)).toBe(false);
    expect(isIndexable("vetify-abc.vercel.app", "/", true, urls)).toBe(false);
  });

  it("writes robots rules per site", () => {
    expect(robotsAllow("www.vetify.live", true, urls)).toEqual(["/"]);
    expect(robotsAllow("app.vetify.live", true, urls)).toEqual([
      "/registro",
      "/iniciar-sesion",
      "/instalar",
    ]);
    expect(robotsAllow("stg.vetify.live", false, urls)).toEqual([]);
    expect(robotsAllow("vetify-abc.vercel.app", true, urls)).toEqual([]);
  });

  it("sends each role home, on another site with a full URL", () => {
    // An owner session on the clinic site must leave it: a client-side
    // navigation to /mascotas there redirected cross-origin and looped.
    expect(homeTarget("owner", "clinica.vetify.live", urls)).toEqual({
      type: "url",
      url: "https://app.vetify.live/mascotas",
    });
    expect(homeTarget("admin", "app.vetify.live", urls)).toEqual({
      type: "url",
      url: "https://clinica.vetify.live/admin/clinicas",
    });
    expect(homeTarget("clinic", "clinica.vetify.live", urls)).toEqual({
      type: "path",
      path: "/pacientes",
    });
    expect(homeTarget("admin", "clinica.vetify.live", urls)).toEqual({
      type: "path",
      path: "/admin/clinicas",
    });
    // Local development and previews serve every route on one host.
    expect(homeTarget("owner", "localhost:3000", {})).toEqual({
      type: "path",
      path: "/mascotas",
    });
  });

  it("serves the clinic's cards on the clinic site, apart from the owner's carné", () => {
    expect(siteOfPath("/carnes")).toBe("clinic");
    expect(siteOfPath("/carne")).toBe("owner");
    expect(routeRequest("app.vetify.live", "/carnes", "", urls)).toEqual({
      type: "redirect",
      url: "https://clinica.vetify.live/carnes",
    });
  });

  it("serves the help guides on the landing site", () => {
    expect(siteOfPath("/ayuda")).toBe("landing");
    expect(siteOfPath("/ayuda/clinicas")).toBe("landing");
    expect(routeRequest("www.vetify.live", "/ayuda/duenos", "", urls)).toEqual({
      type: "next",
    });
    expect(routeRequest("app.vetify.live", "/ayuda/duenos", "", urls)).toEqual({
      type: "redirect",
      url: "https://www.vetify.live/ayuda/duenos",
    });
  });
});
