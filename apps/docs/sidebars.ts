import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  guia: [
    "intro",
    "primeros-pasos",
    "arquitectura",
    {
      type: "category",
      label: "API",
      collapsed: false,
      items: [
        "api/convenciones",
        "api/autenticacion",
        "api/autorizacion",
        "api/expediente",
        "api/vacunacion",
        "api/errores",
      ],
    },
    "modelo-de-datos",
    "agregar-un-endpoint",
  ],
};

export default sidebars;
