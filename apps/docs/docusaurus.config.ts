import type * as Preset from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";
import type { ScalarOptions } from "@scalar/docusaurus";
import { themes as prismThemes } from "prism-react-renderer";
// El tema de la referencia vive con el API, que la sirve en /api/docs; el
// sitio lo reutiliza para que ambas se vean igual.
import { TEMA_SCALAR } from "../api/src/common/openapi/tema-scalar";

const config: Config = {
  title: "Vetify",
  tagline: "Documentación técnica del expediente clínico compartido de mascotas",
  favicon: "img/favicon.ico",
  url: "https://vetify-docs.vercel.app",
  baseUrl: "/",
  organizationName: "FranMoraCz17",
  projectName: "Vetify",
  onBrokenLinks: "throw",
  markdown: { hooks: { onBrokenMarkdownLinks: "throw" } },
  i18n: { defaultLocale: "es", locales: ["es"] },

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
        label: "Referencia del API",
        route: "/referencia",
        showNavLink: true,
        configuration: {
          // Exportado con `pnpm --filter @vetify/api openapi`.
          url: "/openapi.json",
          theme: "none",
          customCss: TEMA_SCALAR,
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
        { type: "docSidebar", sidebarId: "guia", position: "left", label: "Guía" },
        {
          href: "https://github.com/FranMoraCz17/Vetify",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      copyright:
        "Vetify · EIF409 Aplicaciones Informáticas Globales · Universidad Nacional, Sede Brunca · 2026",
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.vsDark,
      additionalLanguages: ["bash", "json"],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
