import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  effectivePlan,
  extendPeriod,
  judgeSession,
  newOrderNumber,
  toMinorUnits,
  verifyWebhookSignature,
  type ExpectedPayment,
} from './billing.logic.js';
import type { OnvoCheckoutSession, OnvoPaymentIntent } from './onvo.client.js';

const day = 24 * 60 * 60 * 1000;
const now = new Date('2026-11-07T12:00:00Z');
const expected: ExpectedPayment = {
  orderNumber: 'VTF1',
  amount: 150_000,
  currency: 'CRC',
  mode: 'test',
};
const paid: OnvoCheckoutSession = {
  id: 'cs_1',
  status: 'complete',
  paymentStatus: 'paid',
  paymentIntentId: 'pi_1',
  mode: 'test',
  amountTotal: 150_000,
  currency: 'CRC',
  metadata: { orderNumber: 'VTF1' },
};
const succeeded: OnvoPaymentIntent = {
  id: 'pi_1',
  status: 'succeeded',
  amount: 150_000,
  currency: 'CRC',
  mode: 'test',
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
    ).toEqual({ plan: 'free', until: null });
    expect(effectivePlan('premium', null, now, 'free').plan).toBe('free');
  });

  it('converts amounts to minor units', () => {
    expect(toMinorUnits('1500.00')).toBe(150_000);
    expect(toMinorUnits('45000.00')).toBe(4_500_000);
    expect(toMinorUnits('0.29')).toBe(29);
  });

  it('approves only a paid session whose intent succeeded', () => {
    expect(judgeSession(paid, succeeded, expected)).toBe('approved');
    const { metadata: _m, amountTotal: _a, mode: _s, ...bare } = paid;
    expect(judgeSession(bare, succeeded, expected)).toBe('approved');
    expect(
      judgeSession(
        { ...paid, status: 'open', paymentStatus: 'unpaid' },
        null,
        expected,
      ),
    ).toBe('pending');
    expect(judgeSession({ ...paid, status: 'open' }, succeeded, expected)).toBe(
      'pending',
    );
    expect(
      judgeSession(
        { ...paid, status: 'expired', paymentStatus: 'unpaid' },
        null,
        expected,
      ),
    ).toBe('declined');
  });

  it('never approves a session or intent that disagrees', () => {
    const cases: [OnvoCheckoutSession, OnvoPaymentIntent | null][] = [
      [paid, null],
      [paid, { ...succeeded, status: 'failed' }],
      [paid, { ...succeeded, amount: 1_500 }],
      [paid, { ...succeeded, currency: 'USD' }],
      [paid, { ...succeeded, mode: 'live' }],
      [{ ...paid, mode: 'live' }, succeeded],
      [{ ...paid, amountTotal: 1 }, succeeded],
      [{ ...paid, metadata: { orderNumber: 'OTHER' } }, succeeded],
    ];
    for (const [session, intent] of cases) {
      expect(judgeSession(session, intent, expected)).not.toBe('approved');
    }
    expect(judgeSession(paid, succeeded, { ...expected, mode: 'live' })).toBe(
      'mismatch',
    );
  });

  it('builds unguessable order numbers', () => {
    const a = newOrderNumber();
    expect(a).toMatch(/^VTF[0-9A-Z]+$/);
    expect(a).not.toBe(newOrderNumber());
  });
});

describe('webhook signature', () => {
  const secret = 'whsec_test_secret';
  const body = Buffer.from('{"type":"checkout_session.succeeded"}');
  const t = 1_785_758_400;
  const sign = (ts: number, raw: Buffer | string = body, key = secret) =>
    createHmac('sha256', key).update(`${ts}.${raw.toString()}`).digest('hex');

  it('accepts a fresh signature over the raw body', () => {
    expect(
      verifyWebhookSignature(`t=${t},v1=${sign(t)}`, body, secret, t + 10),
    ).toBe(true);
    expect(
      verifyWebhookSignature(
        `t=${t}, v1=${'0'.repeat(64)}, v1=${sign(t)}`,
        body,
        secret,
        t,
      ),
    ).toBe(true);
  });

  it('rejects anything else', () => {
    const good = `t=${t},v1=${sign(t)}`;
    expect(verifyWebhookSignature(undefined, body, secret, t)).toBe(false);
    expect(verifyWebhookSignature(good, body, '', t)).toBe(false);
    expect(verifyWebhookSignature(good, body, 'whsec_other', t)).toBe(false);
    expect(
      verifyWebhookSignature(good, Buffer.from('{"type":"x"}'), secret, t),
    ).toBe(false);
    expect(verifyWebhookSignature(good, body, secret, t + 301)).toBe(false);
    expect(verifyWebhookSignature(good, body, secret, t - 301)).toBe(false);
    expect(
      verifyWebhookSignature(`t=${t},v1=${sign(t).slice(2)}`, body, secret, t),
    ).toBe(false);
    expect(verifyWebhookSignature(`v1=${sign(t)}`, body, secret, t)).toBe(
      false,
    );
    expect(verifyWebhookSignature(`t=${t},v1=not-hex!`, body, secret, t)).toBe(
      false,
    );
  });
});
