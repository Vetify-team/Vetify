/** Formatos de presentación en español de Costa Rica. */

const formatoFecha = new Intl.DateTimeFormat("es-CR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** AAAA-MM-DD o ISO completo → "7 oct 2026". Las fechas sin hora se leen en UTC. */
export const fecha = (valor: string | null | undefined): string =>
  valor
    ? formatoFecha.format(new Date(valor.length === 10 ? `${valor}T00:00:00Z` : valor))
    : "—";

const MS_POR_DIA = 86_400_000;

/** Días desde hoy hasta una fecha AAAA-MM-DD (negativo si ya pasó). */
export const diasHasta = (valor: string): number => {
  const hoyUtc = Date.parse(`${hoy()}T00:00:00Z`);
  return Math.round((Date.parse(`${valor}T00:00:00Z`) - hoyUtc) / MS_POR_DIA);
};

/** Distancia legible: "12 días", "2 meses", "un año". Sin signo. */
export const distancia = (dias: number): string => {
  const d = Math.abs(dias);
  if (d < 31) return d === 1 ? "1 día" : `${d} días`;
  const meses = Math.round(d / 30.4);
  if (meses < 12) return meses === 1 ? "1 mes" : `${meses} meses`;
  const anios = Math.round(d / 365);
  return anios === 1 ? "un año" : `${anios} años`;
};

/** Saludo según la hora local. */
export const saludo = (): string => {
  const hora = new Date().getHours();
  return hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
};

/** Edad legible a partir de la fecha de nacimiento. */
export const edad = (fechaNacimiento: string | null): string | null => {
  if (!fechaNacimiento) return null;
  const nacimiento = new Date(`${fechaNacimiento}T00:00:00Z`);
  const hoy = new Date();
  let meses =
    (hoy.getUTCFullYear() - nacimiento.getUTCFullYear()) * 12 +
    (hoy.getUTCMonth() - nacimiento.getUTCMonth());
  if (hoy.getUTCDate() < nacimiento.getUTCDate()) meses -= 1;
  if (meses < 1) return "menos de un mes";
  if (meses < 12) return `${meses} ${meses === 1 ? "mes" : "meses"}`;
  const anios = Math.floor(meses / 12);
  return `${anios} ${anios === 1 ? "año" : "años"}`;
};

/** Fecha de hoy en AAAA-MM-DD, para el valor por defecto de los campos de fecha. */
// en-CA da AAAA-MM-DD en la zona horaria del dispositivo (no en UTC, que
// después de las 6 p. m. en Costa Rica ya es el día siguiente).
export const hoy = (): string => new Date().toLocaleDateString("en-CA");

export const nombreEspecie = {
  perro: "Perro",
  gato: "Gato",
  otro: "Otra especie",
} as const;
