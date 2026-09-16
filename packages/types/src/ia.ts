import { z } from "zod";
import { fechaHoraSchema, idSchema } from "./comun.js";

export const severidadSchema = z.enum(["baja", "media", "alta"]);
export type Severidad = z.infer<typeof severidadSchema>;

export const anomaliaSchema = z.object({
  id: idSchema,
  mascotaId: idSchema,
  // Por ahora solo 'peso'; se deja abierto como en la base.
  tipo: z.string().min(1).max(40),
  severidad: severidadSchema,
  confianza: z.number().min(0).max(1).nullable(),
  detalle: z.string().max(2000).nullable(),
  fecha: fechaHoraSchema,
});
export type Anomalia = z.infer<typeof anomaliaSchema>;

/** Resumen previo a la consulta que genera el módulo de IA. */
export const resumenPrevioSchema = z.object({
  mascotaId: idSchema,
  resumen: z.string(),
  puntosClave: z.array(z.string()),
  generadoEn: fechaHoraSchema,
});
export type ResumenPrevio = z.infer<typeof resumenPrevioSchema>;
