import { describe, expect, it } from "vitest";
import { installsAs, manifestFor } from "../src/lib/manifest";
import { siteOfHost, type SiteUrls } from "../src/lib/sites";

const production: SiteUrls = {
  landing: "https://www.vetify.live",
  owner: "https://app.vetify.live",
  clinic: "https://clinica.vetify.live",
};
const staging: SiteUrls = {
  landing: "https://stg.vetify.live",
  owner: "https://app.stg.vetify.live",
  clinic: "https://clinica.stg.vetify.live",
};

const manifestOfHost = (host: string, urls: SiteUrls) =>
  manifestFor(siteOfHost(host, urls));

describe("installable sites", () => {
  it.each([
    [
      "production",
      production,
      "www.vetify.live",
      "app.vetify.live",
      "clinica.vetify.live",
    ],
    [
      "staging",
      staging,
      "stg.vetify.live",
      "app.stg.vetify.live",
      "clinica.stg.vetify.live",
    ],
  ] as const)(
    "%s: only the owner and clinic hosts install",
    (_env, urls, landing, owner, clinic) => {
      expect(manifestOfHost(landing, urls)).toBeNull();
      expect(manifestOfHost(owner, urls)).toMatchObject({
        name: "Vetify",
        start_url: "/mascotas",
        scope: "/",
        id: "/mascotas",
        display: "standalone",
      });
      expect(manifestOfHost(clinic, urls)).toMatchObject({
        name: "Vetify Clínica",
        start_url: "/pacientes",
        scope: "/",
        id: "/pacientes",
        display: "standalone",
      });
    },
  );

  it("keeps the owner and clinic apps apart on the same device", () => {
    const owner = manifestFor("owner")!;
    const clinic = manifestFor("clinic")!;
    expect(owner.id).not.toBe(clinic.id);
    expect(owner.name).not.toBe(clinic.name);
  });

  it("installs a host that is not a configured site as the owner app, as before", () => {
    expect(installsAs(siteOfHost("localhost:3000", {}))).toBe("owner");
    expect(installsAs(siteOfHost("vetify-git-dev.vercel.app", production))).toBe("owner");
  });

  it("uses Vetify's paper color and the maskable icon", () => {
    const owner = manifestFor("owner")!;
    expect(owner.theme_color).toBe("#f4efe5");
    expect(owner.background_color).toBe("#f4efe5");
    expect(owner.icons?.some((i) => i.purpose === "maskable")).toBe(true);
  });
});
