import { z } from "zod";
import { fechaSchema, idSchema } from "./comun.js";
import { especieSchema } from "./mascota.js";

/**
 * Respuesta pública de /verificar/[token]. Expone únicamente la vigencia de
 * vacunas: nunca el expediente completo ni datos de contacto del dueño.
 */
export const carneVerificadoSchema = z.object({
  mascota: z.object({
    nombre: z.string(),
    especie: especieSchema,
    raza: z.string().nullable(),
  }),
  vacunas: z.array(
    z.object({
      tipo: z.string(),
      fechaAplicacion: fechaSchema,
      fechaVencimiento: fechaSchema.nullable(),
      vigente: z.boolean(),
    }),
  ),
  emitidoEn: fechaSchema,
});
export type CarneVerificado = z.infer<typeof carneVerificadoSchema>;

/** Token firmado por el API. El cliente nunca lo arma por su cuenta. */
export const tokenCarneSchema = z.object({
  token: z.string().min(1),
  mascotaId: idSchema,
  expiraEn: z.iso.datetime({ offset: true }),
});
export type TokenCarne = z.infer<typeof tokenCarneSchema>;
