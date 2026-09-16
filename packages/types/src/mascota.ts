import { z } from "zod";
import { fechaHoraSchema, fechaSchema, idSchema } from "./comun.js";

export const especieSchema = z.enum(["perro", "gato", "otro"]);
export type Especie = z.infer<typeof especieSchema>;

export const sexoAnimalSchema = z.enum(["macho", "hembra"]);
export type SexoAnimal = z.infer<typeof sexoAnimalSchema>;

export const mascotaSchema = z.object({
  id: idSchema,
  duenoId: idSchema,
  nombre: z.string().min(1).max(80),
  especie: especieSchema,
  raza: z.string().max(80).nullable(),
  sexo: sexoAnimalSchema.nullable(),
  fechaNacimiento: fechaSchema.nullable(),
  esterilizado: z.boolean(),
  microchip: z.string().max(40).nullable(),
  fotoUrl: z.url().nullable(),
  creadoEn: fechaHoraSchema,
});
export type Mascota = z.infer<typeof mascotaSchema>;

export const crearMascotaSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio").max(80),
  especie: especieSchema,
  raza: z.string().max(80).optional(),
  sexo: sexoAnimalSchema.optional(),
  fechaNacimiento: fechaSchema.optional(),
  esterilizado: z.boolean().default(false),
  microchip: z.string().max(40).optional(),
  fotoUrl: z.url().optional(),
});
export type CrearMascota = z.infer<typeof crearMascotaSchema>;

export const actualizarMascotaSchema = crearMascotaSchema.partial();
export type ActualizarMascota = z.infer<typeof actualizarMascotaSchema>;
