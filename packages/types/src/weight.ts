/**
 * Sudden weight change between two consecutive weight entries.
 *
 * A change of 10 % or more counts as sudden when the entries are at most 90
 * days apart; over longer gaps a change is expected and says little. Pets
 * younger than a year are still growing, so only a loss counts for them.
 * Shared by the API (which notifies the owner) and the web (which shows it
 * on the weight page), so both apply the same rule.
 */
export const WEIGHT_ALERT_PERCENT = 10;
export const WEIGHT_ALERT_MAX_DAYS = 90;

export interface WeightPoint {
  /** `YYYY-MM-DD` */
  date: string;
  weightKg: number;
}

export interface WeightChange {
  deltaKg: number;
  /** Signed, relative to the previous entry. */
  percent: number;
  previous: WeightPoint;
  latest: WeightPoint;
}

const DAY_MS = 86_400_000;
const time = (date: string) => Date.parse(`${date}T00:00:00Z`);

/** The sudden change from `previous` to `latest`, or null if there is none. */
export function suddenWeightChange(
  previous: WeightPoint,
  latest: WeightPoint,
  birthDate: string | null,
): WeightChange | null {
  if (previous.weightKg <= 0) return null;
  const days = (time(latest.date) - time(previous.date)) / DAY_MS;
  if (days < 0 || days > WEIGHT_ALERT_MAX_DAYS) return null;

  const deltaKg = latest.weightKg - previous.weightKg;
  const percent = (deltaKg / previous.weightKg) * 100;
  if (Math.abs(percent) < WEIGHT_ALERT_PERCENT) return null;

  if (deltaKg > 0 && birthDate) {
    const firstBirthday = new Date(time(birthDate));
    firstBirthday.setUTCFullYear(firstBirthday.getUTCFullYear() + 1);
    if (time(latest.date) < firstBirthday.getTime()) return null;
  }
  return { deltaKg, percent, previous, latest };
}

const kg = (value: number) =>
  `${value.toLocaleString("es-CR", { maximumFractionDigits: 1 })} kg`;

/** "bajó 1,2 kg (12 %)" or "subió 3 kg (15 %)". */
export function describeWeightChange(change: WeightChange): string {
  const verb = change.deltaKg < 0 ? "bajó" : "subió";
  const percent = Math.round(Math.abs(change.percent));
  return `${verb} ${kg(Math.abs(change.deltaKg))} (${percent} %)`;
}
