/** Display formats in Costa Rican Spanish. */

const dateFormat = new Intl.DateTimeFormat("es-CR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** YYYY-MM-DD or full ISO → "7 oct 2026". Dates without time are read as UTC. */
export const formatDate = (value: string | null | undefined): string =>
  value
    ? dateFormat.format(new Date(value.length === 10 ? `${value}T00:00:00Z` : value))
    : "—";

const DAY_MS = 86_400_000;

/**
 * Today as YYYY-MM-DD in the device's time zone (en-CA formats that way).
 * Not the UTC date: after 6 p.m. in Costa Rica that is already tomorrow.
 */
export const today = (): string => new Date().toLocaleDateString("en-CA");

/** Days from today to a YYYY-MM-DD date (negative if past). */
export const daysUntil = (value: string): number =>
  Math.round(
    (Date.parse(`${value}T00:00:00Z`) - Date.parse(`${today()}T00:00:00Z`)) / DAY_MS,
  );

/** Readable distance: "12 días", "2 meses", "un año". Unsigned. */
export const distance = (days: number): string => {
  const d = Math.abs(days);
  if (d < 31) return d === 1 ? "1 día" : `${d} días`;
  const months = Math.round(d / 30.4);
  if (months < 12) return months === 1 ? "1 mes" : `${months} meses`;
  const years = Math.round(d / 365);
  return years === 1 ? "un año" : `${years} años`;
};

/** Greeting by local hour. */
export const greeting = (): string => {
  const hour = new Date().getHours();
  return hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
};

/** Readable age from the birth date. */
export const age = (birthDate: string | null): string | null => {
  if (!birthDate) return null;
  const born = new Date(`${birthDate}T00:00:00Z`);
  const now = new Date();
  let months =
    (now.getUTCFullYear() - born.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - born.getUTCMonth());
  if (now.getUTCDate() < born.getUTCDate()) months -= 1;
  if (months < 1) return "menos de un mes";
  if (months < 12) return `${months} ${months === 1 ? "mes" : "meses"}`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "año" : "años"}`;
};
