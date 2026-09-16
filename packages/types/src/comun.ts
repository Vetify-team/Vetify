import { z } from "zod";

/** Identificador de cualquier entidad del expediente. */
export const idSchema = z.uuid({ message: "Identificador inválido" });
export type Id = z.infer<typeof idSchema>;

/** Fecha sin hora, tal como la guarda PostgreSQL en columnas `date`. */
export const fechaSchema = z.iso.date({ message: "Fecha inválida (se espera AAAA-MM-DD)" });
export type Fecha = z.infer<typeof fechaSchema>;

/** Marca de tiempo completa (columnas `timestamptz`). */
export const fechaHoraSchema = z.iso.datetime({ offset: true });
export type FechaHora = z.infer<typeof fechaHoraSchema>;

/** Parámetros de paginación aceptados por los listados del API. */
export const paginacionSchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
});
export type Paginacion = z.infer<typeof paginacionSchema>;

/** Envoltura de un listado paginado devuelto por el API. */
export const paginadoSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    datos: z.array(item),
    total: z.number().int().min(0),
    pagina: z.number().int().min(1),
    porPagina: z.number().int().min(1),
  });

export type Paginado<T> = {
  datos: T[];
  total: number;
  pagina: number;
  porPagina: number;
};
