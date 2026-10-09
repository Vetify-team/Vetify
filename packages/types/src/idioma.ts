import { z } from "zod";

/**
 * Mensajes de validación en español para todo Vetify. Como el API y la web
 * importan los esquemas desde este paquete, se configura una sola vez acá.
 * `customError` corrige los casos donde el locale de Zod suena poco natural.
 */
z.config(z.locales.es());
z.config({
  customError: (problema) => {
    if (problema.input === undefined || problema.input === "")
      return "Este campo es obligatorio";
    if (problema.code === "invalid_format" && problema.format === "email") {
      return "Correo electrónico inválido";
    }
    return undefined;
  },
});
