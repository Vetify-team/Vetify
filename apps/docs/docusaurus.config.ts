import type * as Preset from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";
import type { ScalarOptions } from "@scalar/docusaurus";
import { themes as prismThemes } from "prism-react-renderer";
// The reference theme lives with the API, which serves it at /api/docs; the
// site reuses it so both look the same.
import { SCALAR_THEME } from "../api/src/common/openapi/scalar-theme";

const config: Config = {
  title: "Vetify",
  tagline: "Technical documentation of the shared clinical record for pets",
  favicon: "img/favicon.ico",
  url: "https://vetify-docs.vercel.app",
  baseUrl: "/",
  organizationName: "FranMoraCz17",
  projectName: "Vetify",
  onBrokenLinks: "throw",
  markdown: { hooks: { onBrokenMarkdownLinks: "throw" } },
  i18n: { defaultLocale: "en", locales: ["en"] },

  presets: [
    [
      "classic",
      {
        docs: {
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
          editUrl: "https://github.com/FranMoraCz17/Vetify/tree/dev/apps/docs/",
        },
        blog: false,
        theme: { customCss: "./src/css/custom.css" },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      "@scalar/docusaurus",
      {
        label: "API reference",
        route: "/referencia",
        showNavLink: true,
        // Pinned bundle: the page never runs whatever "latest" is today.
        cdn: "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.75.1",
        configuration: {
          // Exported with `pnpm --filter @vetify/api openapi`.
          url: "/openapi.json",
          theme: "none",
          customCss: SCALAR_THEME,
          showDeveloperTools: "never",
          agent: { disabled: true },
          mcp: { disabled: true },
          telemetry: false,
          defaultHttpClient: { targetKey: "js", clientKey: "fetch" },
        },
      } satisfies ScalarOptions,
    ],
  ],

  themeConfig: {
    colorMode: { respectPrefersColorScheme: true },
    navbar: {
      title: "Vetify",
      items: [
        { type: "docSidebar", sidebarId: "guide", position: "left", label: "Guide" },
        {
          href: "https://github.com/FranMoraCz17/Vetify",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      copyright:
        "Vetify · EIF409 Global Computing Applications · Universidad Nacional, Brunca campus · 2026",
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.vsDark,
      additionalLanguages: ["bash", "json"],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
