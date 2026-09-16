import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Preset base de ESLint para los paquetes y apps de Vetify.
 * Cada app lo extiende y agrega lo suyo (Next.js, NestJS).
 */
export const vetifyBaseConfig = tseslint.config(
  { ignores: ["**/dist/**", "**/.next/**", "**/node_modules/**", "**/*.config.*"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
    },
  },
);

export default vetifyBaseConfig;
