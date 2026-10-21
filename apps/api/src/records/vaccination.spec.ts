import { describe, expect, it } from 'vitest';
import { fromIsoDate } from '../common/dates.js';
import {
  addMonths,
  alertsForPet,
  computeVaccinationStatus,
  sortAlerts,
  type ScheduleRule,
} from './vaccination.js';

const schedule: ScheduleRule[] = [
  { vaccine: 'Polivalente', minAgeMonths: 2, validityMonths: 12 },
  { vaccine: 'Rabia', minAgeMonths: 3, validityMonths: 12 },
  { vaccine: 'Leptospirosis', minAgeMonths: 3, validityMonths: 12 },
  { vaccine: 'Tos de las perreras', minAgeMonths: 3, validityMonths: 12 },
];

const today = fromIsoDate('2026-10-07');

const compute = (
  applied: { vaccine: string; appliedOn: string; expiresOn?: string }[],
  birthDate: string | null,
) =>
  computeVaccinationStatus({
    country: 'CR',
    species: 'dog',
    schedule,
    applied: applied.map((a) => ({
      vaccine: a.vaccine,
      appliedOn: fromIsoDate(a.appliedOn),
      expiresOn: a.expiresOn ? fromIsoDate(a.expiresOn) : null,
    })),
    birthDate: birthDate ? fromIsoDate(birthDate) : null,
    today,
  });

const statusOf = (result: ReturnType<typeof compute>, vaccine: string) =>
  result.vaccines.find((v) => v.vaccine === vaccine);

describe('computeVaccinationStatus', () => {
  it('classifies valid, expiring, expired and due', () => {
    const result = compute(
      [
        { vaccine: 'Polivalente', appliedOn: '2026-03-01' },
        { vaccine: 'rabia', appliedOn: '2025-10-20' },
        { vaccine: 'Leptospirosis', appliedOn: '2025-01-10' },
      ],
      '2022-05-01',
    );
    expect(statusOf(result, 'Polivalente')).toMatchObject({
      status: 'valid',
      expiresOn: '2027-03-01',
    });
    expect(statusOf(result, 'Rabia')).toMatchObject({
      status: 'expiring',
      nextDueOn: '2026-10-20',
    });
    expect(statusOf(result, 'Leptospirosis')).toMatchObject({
      status: 'expired',
      nextDueOn: null,
    });
    expect(statusOf(result, 'Tos de las perreras')).toMatchObject({
      status: 'due',
    });
    expect(result.coverage).toBe(50);
  });

  it('uses the latest application and an expiry set by the clinic', () => {
    const result = compute(
      [
        { vaccine: 'Rabia', appliedOn: '2024-01-01' },
        { vaccine: 'Rabia', appliedOn: '2026-06-01', expiresOn: '2029-06-01' },
      ],
      '2022-05-01',
    );
    expect(statusOf(result, 'Rabia')).toMatchObject({
      status: 'valid',
      lastAppliedOn: '2026-06-01',
      expiresOn: '2029-06-01',
    });
  });

  it('marks a puppy below the minimum age as not yet due and says when', () => {
    const result = compute([], '2026-07-20');
    expect(statusOf(result, 'Polivalente')).toMatchObject({ status: 'due' });
    expect(statusOf(result, 'Rabia')).toMatchObject({
      status: 'not_yet_due',
      nextDueOn: '2026-10-20',
    });
  });

  it('without a birth date assumes the vaccine is due', () => {
    expect(statusOf(compute([], null), 'Rabia')).toMatchObject({
      status: 'due',
      nextDueOn: null,
    });
  });

  it('keeps the latest deworming of each kind', () => {
    const result = computeVaccinationStatus({
      country: 'CR',
      species: 'dog',
      schedule: [],
      applied: [],
      dewormings: [
        {
          kind: 'internal',
          product: 'A',
          appliedOn: fromIsoDate('2026-01-01'),
          nextDueOn: fromIsoDate('2026-04-01'),
        },
        {
          kind: 'internal',
          product: 'B',
          appliedOn: fromIsoDate('2026-07-01'),
          nextDueOn: fromIsoDate('2026-10-19'),
        },
        {
          kind: 'external',
          product: 'C',
          appliedOn: fromIsoDate('2026-09-01'),
          nextDueOn: null,
        },
      ],
      birthDate: null,
      today,
    });
    expect(result.dewormings).toHaveLength(2);
    expect(result.dewormings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'internal',
          product: 'B',
          status: 'expiring',
        }),
        expect.objectContaining({
          kind: 'external',
          status: 'valid',
          nextDueOn: null,
        }),
      ]),
    );
  });

  it('sorts alerts with overdue doses first, then by date', () => {
    const status = compute(
      [
        { vaccine: 'Polivalente', appliedOn: '2026-03-01' },
        { vaccine: 'Rabia', appliedOn: '2025-10-20' },
        { vaccine: 'Leptospirosis', appliedOn: '2025-01-10' },
      ],
      '2022-05-01',
    );
    const alerts = sortAlerts(alertsForPet({ id: 'p1', name: 'Luna' }, status));
    expect(alerts.map((a) => `${a.name}:${a.status}`)).toEqual([
      'Leptospirosis:expired',
      'Tos de las perreras:due',
      'Rabia:expiring',
      'Polivalente:valid',
    ]);
    expect(alerts[0]).toMatchObject({ petName: 'Luna', dueOn: '2026-01-10' });
  });
});

describe('addMonths', () => {
  it('clamps to the last day when the target month is shorter', () => {
    expect(
      addMonths(fromIsoDate('2026-01-31'), 1).toISOString().slice(0, 10),
    ).toBe('2026-02-28');
  });
});
