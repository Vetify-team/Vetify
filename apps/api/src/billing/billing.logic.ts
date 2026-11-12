import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type {
  OnvoCheckoutSession,
  OnvoMode,
  OnvoPaymentIntent,
} from './onvo.client.js';

/** Our reference for a payment: short, alphanumeric and unguessable. */
export const newOrderNumber = (now = Date.now()): string =>
  `VTF${now.toString(36).toUpperCase()}${randomBytes(4).toString('hex').toUpperCase()}`;

/** Amount in the currency's minor unit, from a "1500.00" decimal string. */
export const toMinorUnits = (amount: string): number =>
  Math.round(Number(amount) * 100);

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
  /** Minor units. */
  amount: number;
  currency: string;
  mode: OnvoMode;
}

export type Verdict = 'approved' | 'declined' | 'pending' | 'mismatch';

/**
 * What ONVO's record of our Checkout session means for the payment. Only a
 * paid session whose payment intent succeeded for the same amount, currency
 * and mode approves it; anything that disagrees is a mismatch and is never
 * approved. `intent` is read only for a paid session.
 */
export function judgeSession(
  session: OnvoCheckoutSession,
  intent: OnvoPaymentIntent | null,
  expected: ExpectedPayment,
): Verdict {
  const reference = session.metadata?.orderNumber;
  if (reference !== undefined && reference !== expected.orderNumber)
    return 'mismatch';
  if (session.mode !== undefined && session.mode !== expected.mode)
    return 'mismatch';
  if (session.paymentStatus !== 'paid') {
    return session.status === 'expired' ? 'declined' : 'pending';
  }
  if (session.status !== 'complete' || !intent) return 'pending';
  if (intent.status !== 'succeeded') return 'mismatch';
  if (intent.amount !== expected.amount) return 'mismatch';
  if (String(intent.currency).toUpperCase() !== expected.currency)
    return 'mismatch';
  if (intent.mode !== expected.mode) return 'mismatch';
  if (
    session.amountTotal !== undefined &&
    session.amountTotal !== expected.amount
  )
    return 'mismatch';
  return 'approved';
}

/** Oldest or newest signature timestamp accepted, in seconds. */
export const WEBHOOK_TOLERANCE_S = 300;

/**
 * Whether the free plan's pet limit applies. Only while payments are on:
 * otherwise an owner at the limit would have no way to upgrade.
 */
export const capsPets = (billingEnabled: boolean, plan: string): boolean =>
  billingEnabled && plan === 'free';

/**
 * Whether an owner's assistant messages are capped per month. Same rule as
 * the pet limit: only on the free plan, and only while payments are on.
 */
export const capsAssistant = capsPets;

/**
 * Checks an `X-Onvo-Signature: t=<unix>,v1=<hex>` header: HMAC-SHA256 of
 * `<t>.<raw body>` with the endpoint's signing secret, compared in constant
 * time, and a timestamp within five minutes of now.
 */
export function verifyWebhookSignature(
  header: string | undefined,
  rawBody: Buffer,
  secret: string,
  nowS = Math.floor(Date.now() / 1000),
): boolean {
  if (!header || !secret) return false;
  let timestamp: string | undefined;
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const [key, value] = part.trim().split('=', 2);
    if (key === 't') timestamp = value;
    else if (key === 'v1' && value) signatures.push(value);
  }
  if (!timestamp || !/^\d+$/.test(timestamp) || !signatures.length)
    return false;
  if (Math.abs(nowS - Number(timestamp)) > WEBHOOK_TOLERANCE_S) return false;
  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest();
  return signatures.some((signature) => {
    if (!/^[0-9a-f]+$/i.test(signature)) return false;
    const given = Buffer.from(signature, 'hex');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
