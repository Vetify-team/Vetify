import { describe, expect, it } from 'vitest';
import {
  effectivePlan,
  extendPeriod,
  judgeTransaction,
  newOrderNumber,
  splitName,
  type ExpectedPayment,
} from './billing.logic.js';

const day = 24 * 60 * 60 * 1000;
const now = new Date('2026-11-07T12:00:00Z');
const expected: ExpectedPayment = {
  orderNumber: 'VTF1',
  amount: '1500.00',
  currency: 'CRC',
  environment: 'test',
};
const approved = {
  orderNumber: 'VTF1',
  code: '1',
  amount: '1500.00',
  currency: 'CRC',
  environment: 'Test',
};

describe('billing logic', () => {
  it('extends from the current period or from now', () => {
    expect(extendPeriod(null, now, 30).getTime()).toBe(
      now.getTime() + 30 * day,
    );
    const later = new Date(now.getTime() + 10 * day);
    expect(extendPeriod(later, now, 30).getTime()).toBe(
      later.getTime() + 30 * day,
    );
    const expired = new Date(now.getTime() - day);
    expect(extendPeriod(expired, now, 30).getTime()).toBe(
      now.getTime() + 30 * day,
    );
  });

  it('keeps a paid plan only until its date', () => {
    const until = new Date(now.getTime() + day);
    expect(effectivePlan('premium', until, now, 'free')).toEqual({
      plan: 'premium',
      until,
    });
    expect(
      effectivePlan('premium', new Date(now.getTime() - 1), now, 'free'),
    ).toEqual({
      plan: 'free',
      until: null,
    });
    expect(effectivePlan('premium', null, now, 'free').plan).toBe('free');
  });

  it('approves only a matching approved transaction', () => {
    expect(judgeTransaction(approved, expected)).toBe('approved');
    expect(judgeTransaction({ ...approved, amount: '1500' }, expected)).toBe(
      'approved',
    );
    expect(judgeTransaction(null, expected)).toBe('pending');
    expect(judgeTransaction({ ...approved, code: '2' }, expected)).toBe(
      'declined',
    );
  });

  it('never approves a transaction that disagrees', () => {
    expect(judgeTransaction({ ...approved, amount: '15.00' }, expected)).toBe(
      'mismatch',
    );
    expect(judgeTransaction({ ...approved, currency: 'USD' }, expected)).toBe(
      'mismatch',
    );
    expect(
      judgeTransaction({ ...approved, orderNumber: 'OTHER' }, expected),
    ).toBe('mismatch');
    expect(
      judgeTransaction({ ...approved, environment: 'Production' }, expected),
    ).toBe('mismatch');
    expect(
      judgeTransaction(approved, { ...expected, environment: 'production' }),
    ).toBe('mismatch');
  });

  it('builds order numbers and buyer names', () => {
    const a = newOrderNumber();
    expect(a).toMatch(/^VTF[0-9A-Z]+$/);
    expect(a).not.toBe(newOrderNumber());
    expect(splitName('Ana María Solís')).toEqual({
      firstName: 'Ana',
      lastName: 'María Solís',
    });
    expect(splitName('Ana')).toEqual({ firstName: 'Ana', lastName: 'Ana' });
  });
});
