import { describe, expect, it } from "vitest";
import {
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
    expect(siteOfPath("/inicio")).toBe("landing");
    expect(siteOfPath("/instalar")).toBe("landing");
    expect(siteOfPath("/clinicas")).toBe("landing");
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

  it("serves the install and clinic pages on the landing host", () => {
    expect(routeRequest("www.vetify.live", "/instalar", "", urls)).toEqual({
      type: "next",
    });
    expect(routeRequest("www.vetify.live", "/clinicas", "", urls)).toEqual({
      type: "next",
    });
    expect(routeRequest("app.vetify.live", "/instalar", "?a=1", urls)).toEqual({
      type: "redirect",
      url: "https://www.vetify.live/instalar?a=1",
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
    ]);
    expect(robotsAllow("stg.vetify.live", false, urls)).toEqual([]);
    expect(robotsAllow("vetify-abc.vercel.app", true, urls)).toEqual([]);
  });
});
