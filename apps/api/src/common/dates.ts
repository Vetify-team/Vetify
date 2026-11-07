/**
 * Conversions between Prisma values and @vetify/types contracts. `date`
 * columns are exposed as YYYY-MM-DD and `timestamptz` columns as ISO 8601.
 */

export const toIsoDate = (date: Date): string =>
  date.toISOString().slice(0, 10);

export const toIsoDateOrNull = (date: Date | null): string | null =>
  date ? toIsoDate(date) : null;

export const toIsoDateTime = (date: Date): string => date.toISOString();

/** YYYY-MM-DD → Date at UTC midnight, which is how Prisma stores a `date`. */
export const fromIsoDate = (date: string): Date =>
  new Date(`${date}T00:00:00.000Z`);

export const fromIsoDateOrUndefined = (
  date: string | undefined,
): Date | undefined => (date ? fromIsoDate(date) : undefined);

const costaRicaDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Costa_Rica',
});

/**
 * Today in Costa Rica, at UTC midnight, to compare with `date` columns. Not
 * the UTC date: after 6 p.m. in Costa Rica that is already tomorrow.
 */
export const todayInCostaRica = (): Date =>
  fromIsoDate(costaRicaDate.format(new Date()));
