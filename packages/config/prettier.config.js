/**
 * Configuración de Prettier compartida por todo el monorepo.
 * @type {import("prettier").Config}
 */
export const prettierConfig = {
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 90,
  tabWidth: 2,
  endOfLine: "lf",
};

export default prettierConfig;
