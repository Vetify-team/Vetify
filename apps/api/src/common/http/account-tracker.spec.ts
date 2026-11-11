import { describe, expect, it } from 'vitest';
import { accountTracker } from './account-tracker.js';

const token = (payload: unknown) =>
  `Bearer h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;
const track = (req: Record<string, unknown>) =>
  accountTracker({ ip: '203.0.113.9', headers: {}, ...req });

describe('accountTracker', () => {
  it('keys credential requests on the email in the body', () => {
    expect(
      track({
        body: { email: ' Ana@Example.test ' },
        headers: { authorization: token({ sub: 'u1' }) },
      }),
    ).toBe('account:ana@example.test');
  });

  it('keys authenticated requests on the token user, whatever the IP', () => {
    for (const ip of ['198.51.100.1', '198.51.100.2'])
      expect(
        track({ ip, headers: { authorization: token({ sub: 'u1' }) } }),
      ).toBe('user:u1');
  });

  it('falls back to the IP without a usable token', () => {
    for (const authorization of [
      undefined,
      'Bearer not-a-jwt',
      'Basic dTpw',
      'Bearer h.%%%.s',
      token({ sub: 42 }),
      token({ sub: 'x'.repeat(65) }),
    ])
      expect(track({ headers: { authorization } })).toBe('ip:203.0.113.9');
  });
});
