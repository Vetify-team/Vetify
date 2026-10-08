import type { Aviso, Mascota } from "@vetify/types";
import { edad, nombreEspecie } from "@/lib/formato";

/** "Golden Retriever · 4 años" o "Perro · 4 años" si no hay raza. */
export const descripcionMascota = (m: Mascota): string =>
  [m.raza ?? nombreEspecie[m.especie], edad(m.fechaNacimiento)]
    .filter(Boolean)
    .join(" · ");

/** "LUNA · GOLDEN RETRIEVER": rótulo de las pantallas de una mascota. */
export const rotuloMascota = (m: Mascota): string =>
  `${m.nombre} · ${m.raza ?? nombreEspecie[m.especie]}`;

/** Resumen del estado de una mascota a partir de sus avisos. */
export function resumenAvisos(avisos: Aviso[]): { texto: string; accion: boolean } {
  const vencidas = avisos.filter((a) => a.estado === "vencida").length;
  const pendientes = avisos.filter((a) => a.estado === "pendiente").length;
  const porVencer = avisos.filter((a) => a.estado === "por_vencer").length;
  if (vencidas)
    return {
      texto: vencidas === 1 ? "1 dosis vencida" : `${vencidas} dosis vencidas`,
      accion: true,
    };
  if (pendientes)
    return {
      texto: pendientes === 1 ? "1 pendiente" : `${pendientes} pendientes`,
      accion: true,
    };
  if (porVencer) return { texto: "Por vencer", accion: true };
  return { texto: "Al día", accion: false };
}
