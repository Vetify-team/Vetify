import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  guide: [
    "intro",
    "getting-started",
    "architecture",
    {
      type: "category",
      label: "API",
      collapsed: false,
      items: [
        "api/conventions",
        "api/versioning",
        "api/authentication",
        "api/authorization",
        "api/clinic-linking",
        "api/record",
        "api/vaccination",
        "api/errors",
      ],
    },
    "security",
    "data-model",
    "adding-an-endpoint",
  ],
};

export default sidebars;
