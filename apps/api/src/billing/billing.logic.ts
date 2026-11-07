import { randomBytes } from 'node:crypto';
import type { TilopayTransaction } from './tilopay.client.js';

/** Order number sent to Tilopay: short, alphanumeric and unguessable. */
export const newOrderNumber = (now = Date.now()): string =>
  `VTF${now.toString(36).toUpperCase()}${randomBytes(4).toString('hex').toUpperCase()}`;

/**
 * End of the period a new payment buys: it starts when the current paid
 * period ends, or now if there is none, so paying early never loses days.
 */
export function extendPeriod(
  current: Date | null,
  now: Date,
  days: number,
): Date {
  const start = current && current > now ? current : now;
  return new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
}

/** The plan in force: a paid plan only until its date, then the fallback. */
export function effectivePlan(
  plan: string,
  until: Date | null,
  now: Date,
  fallback: string,
): { plan: string; until: Date | null } {
  return until && until > now
    ? { plan, until }
    : { plan: fallback, until: null };
}

export interface ExpectedPayment {
  orderNumber: string;
  amount: string;
  currency: string;
  environment: 'test' | 'production';
}

export type Verdict = 'approved' | 'declined' | 'pending' | 'mismatch';

/**
 * What Tilopay's record of an order means for our payment. Only an approved
 * transaction for the same order, amount, currency and environment approves
 * it; anything that disagrees is a mismatch and is never approved.
 */
export function judgeTransaction(
  tx: TilopayTransaction | null,
  expected: ExpectedPayment,
): Verdict {
  if (!tx) return 'pending';
  if (
    tx.orderNumber !== undefined &&
    String(tx.orderNumber) !== expected.orderNumber
  ) {
    return 'mismatch';
  }
  if (String(tx.code) !== '1') return 'declined';
  if (Number(tx.amount) !== Number(expected.amount)) return 'mismatch';
  if (String(tx.currency).toUpperCase() !== expected.currency)
    return 'mismatch';
  const isTest = String(tx.environment ?? '').toLowerCase() === 'test';
  if ((expected.environment === 'test') !== isTest) return 'mismatch';
  return 'approved';
}

/** Tilopay wants a first and a last name. */
export function splitName(name: string): {
  firstName: string;
  lastName: string;
} {
  const [first = 'Cliente', ...rest] = name.trim().split(/\s+/);
  return { firstName: first, lastName: rest.join(' ') || first };
}
