import { z } from "zod";
import { fechaHoraSchema, idSchema } from "./comun";

export const clinicaSchema = z.object({
  id: idSchema,
  nombre: z.string().min(1).max(160),
  direccion: z.string().max(300).nullable(),
  pais: z.string().length(2).default("CR"),
  plan: z.string().max(40),
  cantidadVeterinarios: z.number().int().min(1),
  creadoEn: fechaHoraSchema,
});
export type Clinica = z.infer<typeof clinicaSchema>;

export const crearClinicaSchema = clinicaSchema
  .pick({ nombre: true })
  .extend({
    direccion: z.string().max(300).optional(),
    pais: z.string().length(2).default("CR"),
    cantidadVeterinarios: z.number().int().min(1).default(1),
  });
export type CrearClinica = z.infer<typeof crearClinicaSchema>;

export const personalClinicaSchema = z.object({
  id: idSchema,
  clinicaId: idSchema,
  usuarioId: idSchema,
  cargo: z.string().max(60),
});
export type PersonalClinica = z.infer<typeof personalClinicaSchema>;
