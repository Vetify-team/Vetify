import { describeWeightChange, suddenWeightChange } from '@vetify/types';
import { describe, expect, it } from 'vitest';

const at = (date: string, weightKg: number) => ({ date, weightKg });
const adult = '2020-01-01';

describe('suddenWeightChange', () => {
  it('flags a loss of 10 % or more within 90 days', () => {
    const change = suddenWeightChange(
      at('2026-10-01', 20),
      at('2026-11-01', 18),
      adult,
    );
    expect(change?.percent).toBeCloseTo(-10);
    expect(describeWeightChange(change!)).toBe('bajó 2 kg (10 %)');
  });

  it('ignores smaller changes', () => {
    expect(
      suddenWeightChange(at('2026-10-01', 20), at('2026-11-01', 18.5), adult),
    ).toBeNull();
  });

  it('ignores entries more than 90 days apart', () => {
    expect(
      suddenWeightChange(at('2026-01-01', 20), at('2026-11-01', 10), adult),
    ).toBeNull();
  });

  it('flags a gain in an adult', () => {
    const change = suddenWeightChange(
      at('2026-10-01', 4),
      at('2026-10-20', 4.6),
      adult,
    );
    expect(describeWeightChange(change!)).toBe('subió 0,6 kg (15 %)');
  });

  it('lets a pet under a year grow, but flags its losses', () => {
    const puppy = '2026-05-01';
    expect(
      suddenWeightChange(at('2026-09-01', 5), at('2026-10-01', 8), puppy),
    ).toBeNull();
    expect(
      suddenWeightChange(at('2026-09-01', 5), at('2026-10-01', 4), puppy),
    ).not.toBeNull();
  });

  it('treats an unknown birth date as an adult', () => {
    expect(
      suddenWeightChange(at('2026-09-01', 5), at('2026-10-01', 8), null),
    ).not.toBeNull();
  });
});
