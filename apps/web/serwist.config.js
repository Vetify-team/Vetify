import { serwist } from "@serwist/next/config";

/**
 * Serwist en "configurator mode": el service worker se compila como un paso
 * aparte con `serwist build`, en vez de inyectar una configuración de webpack
 * en Next.js. Next 16 usa Turbopack por defecto y el modo con webpack ya no
 * es compatible — es el mismo motivo por el que se abandonó next-pwa.
 *
 * La CLI de Serwist exige exactamente este nombre y lo carga como módulo
 * JavaScript, sin pasar por TypeScript: de ahí el "type": "module" del paquete.
 */
export default serwist.withNextConfig(() => ({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  globDirectory: ".next",
}));
