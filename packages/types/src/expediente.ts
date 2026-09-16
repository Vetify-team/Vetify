import { z } from "zod";
import { fechaHoraSchema, fechaSchema, idSchema } from "./comun";
import { especieSchema } from "./mascota";

// ---------- Acto médico: lo registra la clínica con permiso activo ----------

export const consultaSchema = z.object({
  id: idSchema,
  mascotaId: idSchema,
  clinicaId: idSchema.nullable(),
  veterinarioId: idSchema.nullable(),
  fecha: fechaHoraSchema,
  motivo: z.string().max(300).nullable(),
  diagnostico: z.string().max(2000).nullable(),
  notas: z.string().max(4000).nullable(),
});
export type Consulta = z.infer<typeof consultaSchema>;

export const crearConsultaSchema = z.object({
  fecha: fechaHoraSchema.optional(),
  motivo: z.string().max(300).optional(),
  diagnostico: z.string().max(2000).optional(),
  notas: z.string().max(4000).optional(),
});
export type CrearConsulta = z.infer<typeof crearConsultaSchema>;

export const vacunaSchema = z.object({
  id: idSchema,
  mascotaId: idSchema,
  tipo: z.string().min(1).max(120),
  lote: z.string().max(60).nullable(),
  fechaAplicacion: fechaSchema,
  fechaVencimiento: fechaSchema.nullable(),
  clinicaId: idSchema.nullable(),
});
export type Vacuna = z.infer<typeof vacunaSchema>;

export const crearVacunaSchema = z.object({
  tipo: z.string().min(1, "El tipo de vacuna es obligatorio").max(120),
  lote: z.string().max(60).optional(),
  fechaAplicacion: fechaSchema,
  fechaVencimiento: fechaSchema.optional(),
});
export type CrearVacuna = z.infer<typeof crearVacunaSchema>;

export const desparasitacionSchema = z.object({
  id: idSchema,
  mascotaId: idSchema,
  producto: z.string().max(120).nullable(),
  // 'interna' o 'externa'; se deja como texto libre igual que en la base.
  tipo: z.string().max(40).nullable(),
  fecha: fechaSchema,
  proximaFecha: fechaSchema.nullable(),
});
export type Desparasitacion = z.infer<typeof desparasitacionSchema>;

export const crearDesparasitacionSchema = z.object({
  producto: z.string().max(120).optional(),
  tipo: z.string().max(40).optional(),
  fecha: fechaSchema,
  proximaFecha: fechaSchema.optional(),
});
export type CrearDesparasitacion = z.infer<typeof crearDesparasitacionSchema>;

export const tratamientoSchema = z.object({
  id: idSchema,
  consultaId: idSchema.nullable(),
  mascotaId: idSchema,
  descripcion: z.string().min(1).max(2000),
  inicio: fechaSchema.nullable(),
  fin: fechaSchema.nullable(),
});
export type Tratamiento = z.infer<typeof tratamientoSchema>;

export const crearTratamientoSchema = z.object({
  consultaId: idSchema.optional(),
  descripcion: z.string().min(1, "La descripción es obligatoria").max(2000),
  inicio: fechaSchema.optional(),
  fin: fechaSchema.optional(),
});
export type CrearTratamiento = z.infer<typeof crearTratamientoSchema>;

export const examenSchema = z.object({
  id: idSchema,
  mascotaId: idSchema,
  tipo: z.string().max(120).nullable(),
  fecha: fechaSchema,
  archivoUrl: z.url().nullable(),
  resultado: z.string().max(4000).nullable(),
});
export type Examen = z.infer<typeof examenSchema>;

export const crearExamenSchema = z.object({
  tipo: z.string().max(120).optional(),
  fecha: fechaSchema,
  archivoUrl: z.url().optional(),
  resultado: z.string().max(4000).optional(),
});
export type CrearExamen = z.infer<typeof crearExamenSchema>;

// ---------- Día a día: lo registra el dueño ----------

export const registroPesoSchema = z.object({
  id: idSchema,
  mascotaId: idSchema,
  fecha: fechaSchema,
  pesoKg: z.number().positive().max(200),
});
export type RegistroPeso = z.infer<typeof registroPesoSchema>;

export const crearRegistroPesoSchema = z.object({
  fecha: fechaSchema.optional(),
  pesoKg: z.number().positive("El peso debe ser mayor que cero").max(200),
});
export type CrearRegistroPeso = z.infer<typeof crearRegistroPesoSchema>;

export const registroAlimentacionSchema = z.object({
  id: idSchema,
  mascotaId: idSchema,
  fecha: fechaSchema,
  detalle: z.string().max(1000).nullable(),
});
export type RegistroAlimentacion = z.infer<typeof registroAlimentacionSchema>;

export const crearRegistroAlimentacionSchema = z.object({
  fecha: fechaSchema.optional(),
  detalle: z.string().max(1000).optional(),
});
export type CrearRegistroAlimentacion = z.infer<typeof crearRegistroAlimentacionSchema>;

// ---------- Esquema preventivo y recordatorios ----------

export const esquemaVacunacionSchema = z.object({
  id: idSchema,
  pais: z.string().length(2),
  especie: especieSchema,
  vacuna: z.string().min(1).max(120),
  edadMinimaMeses: z.number().int().min(0).nullable(),
  intervaloMeses: z.number().int().min(0).nullable(),
  vigenciaMeses: z.number().int().min(1),
});
export type EsquemaVacunacion = z.infer<typeof esquemaVacunacionSchema>;

export const recordatorioSchema = z.object({
  id: idSchema,
  mascotaId: idSchema,
  // 'vacuna' | 'desparasitacion' | 'peso'; texto libre como en la base.
  tipo: z.string().min(1).max(40),
  fechaObjetivo: fechaSchema,
  canal: z.string().max(20),
  estado: z.string().max(20),
});
export type Recordatorio = z.infer<typeof recordatorioSchema>;

/** Expediente completo de una mascota, tal como lo devuelve el API. */
export const expedienteSchema = z.object({
  consultas: z.array(consultaSchema),
  vacunas: z.array(vacunaSchema),
  desparasitaciones: z.array(desparasitacionSchema),
  tratamientos: z.array(tratamientoSchema),
  examenes: z.array(examenSchema),
  registrosPeso: z.array(registroPesoSchema),
  registrosAlimentacion: z.array(registroAlimentacionSchema),
});
export type Expediente = z.infer<typeof expedienteSchema>;
