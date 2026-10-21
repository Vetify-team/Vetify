import type {
  Alert,
  DewormingStatus,
  ScheduledVaccine,
  Species,
  VaccinationStatus,
  VaccineStatus,
} from '@vetify/types';
import { toIsoDate } from '../common/dates.js';

/** Days before expiry from which a vaccine is "expiring". */
export const EXPIRY_WARNING_DAYS = 30;

const DAY_MS = 86_400_000;

export interface ScheduleRule {
  vaccine: string;
  minAgeMonths: number | null;
  validityMonths: number;
}

export interface AppliedVaccine {
  vaccine: string;
  appliedOn: Date;
  expiresOn: Date | null;
}

export interface AppliedDeworming {
  kind: string | null;
  product: string | null;
  appliedOn: Date;
  nextDueOn: Date | null;
}

/** Adds months in UTC, clamping to the last day when the target month is shorter. */
export const addMonths = (date: Date, months: number): Date => {
  const result = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return result;
};

/** "Antirrábica" and "antirrabica " are the same vaccine. */
export const normalizeName = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

/** Status of something that expires on `date`: past, close, or later. */
export const statusByDate = (date: Date | null, today: Date): VaccineStatus => {
  if (!date) return 'valid';
  const days = (date.getTime() - today.getTime()) / DAY_MS;
  if (days < 0) return 'expired';
  return days <= EXPIRY_WARNING_DAYS ? 'expiring' : 'valid';
};

/** The expiry the clinic recorded or, if none, application + schedule validity. */
export const computeExpiry = (
  applied: AppliedVaccine,
  rule: Pick<ScheduleRule, 'validityMonths'> | undefined,
): Date | null =>
  applied.expiresOn ??
  (rule ? addMonths(applied.appliedOn, rule.validityMonths) : null);

/** The latest deworming of each kind (internal, external…). */
const latestDewormings = (
  applied: AppliedDeworming[],
  today: Date,
): DewormingStatus[] => {
  const byKind = new Map<string, AppliedDeworming>();
  for (const deworming of applied) {
    const key = normalizeName(deworming.kind ?? '');
    const current = byKind.get(key);
    if (!current || deworming.appliedOn > current.appliedOn)
      byKind.set(key, deworming);
  }
  return [...byKind.values()].map((d) => ({
    kind: d.kind,
    product: d.product,
    lastAppliedOn: toIsoDate(d.appliedOn),
    nextDueOn: d.nextDueOn ? toIsoDate(d.nextDueOn) : null,
    status: statusByDate(d.nextDueOn, today),
  }));
};

/**
 * Crosses the preventive schedule (country + species) with the applied
 * vaccines and the pet's age. The record's central "process": the card, the
 * reminders and the coverage the owner sees come from here.
 */
export const computeVaccinationStatus = (input: {
  country: string;
  species: Species;
  schedule: ScheduleRule[];
  applied: AppliedVaccine[];
  dewormings?: AppliedDeworming[];
  birthDate: Date | null;
  today: Date;
}): VaccinationStatus => {
  const { schedule, applied, birthDate, today } = input;

  const vaccines = schedule.map((rule): ScheduledVaccine => {
    const key = normalizeName(rule.vaccine);
    const latest = applied
      .filter((a) => normalizeName(a.vaccine) === key)
      .sort((a, b) => b.appliedOn.getTime() - a.appliedOn.getTime())[0];

    if (latest) {
      const expiry = computeExpiry(latest, rule);
      const status = statusByDate(expiry, today);
      return {
        vaccine: rule.vaccine,
        status,
        lastAppliedOn: toIsoDate(latest.appliedOn),
        expiresOn: expiry ? toIsoDate(expiry) : null,
        nextDueOn: status === 'expired' || !expiry ? null : toIsoDate(expiry),
      };
    }

    // Never applied. Without a birth date it is assumed to be due.
    const availableFrom = birthDate
      ? addMonths(birthDate, rule.minAgeMonths ?? 0)
      : null;
    const notYet = availableFrom !== null && availableFrom > today;
    return {
      vaccine: rule.vaccine,
      status: notYet ? 'not_yet_due' : 'due',
      lastAppliedOn: null,
      expiresOn: null,
      nextDueOn: notYet ? toIsoDate(availableFrom) : null,
    };
  });

  const protectedCount = vaccines.filter(
    (v) => v.status === 'valid' || v.status === 'expiring',
  ).length;

  return {
    country: input.country,
    species: input.species,
    coverage: vaccines.length
      ? Math.round((protectedCount / vaccines.length) * 100)
      : 0,
    vaccines,
    dewormings: latestDewormings(input.dewormings ?? [], today),
  };
};

const PRIORITY: Record<VaccineStatus, number> = {
  expired: 0,
  due: 1,
  expiring: 2,
  valid: 3,
  not_yet_due: 4,
};

/** Turns a pet's status into alerts: what needs action, or has a date ahead. */
export const alertsForPet = (
  pet: { id: string; name: string },
  status: VaccinationStatus,
): Alert[] => {
  const base = { petId: pet.id, petName: pet.name };
  const vaccines: Alert[] = status.vaccines
    .filter((v) => v.status !== 'valid' || v.nextDueOn)
    .map((v) => ({
      ...base,
      kind: 'vaccination',
      name: v.vaccine,
      dueOn: v.status === 'expired' ? v.expiresOn : v.nextDueOn,
      status: v.status,
    }));
  const dewormings: Alert[] = status.dewormings
    .filter((d) => d.nextDueOn)
    .map((d) => ({
      ...base,
      kind: 'deworming',
      name: d.kind ?? 'deworming',
      dueOn: d.nextDueOn,
      status: d.status,
    }));
  return [...vaccines, ...dewormings];
};

/** Overdue first, then by date. */
export const sortAlerts = (alerts: Alert[]): Alert[] =>
  [...alerts].sort(
    (a, b) =>
      PRIORITY[a.status] - PRIORITY[b.status] ||
      (a.dueOn ?? '9999').localeCompare(b.dueOn ?? '9999'),
  );
