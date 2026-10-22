import { describe, expect, it } from 'vitest';
import { isExpired, isSessionActive } from './sessions.js';

describe('session state', () => {
  const now = new Date('2026-10-21T12:00:00.000Z');
  const session = (
    changes: Partial<Parameters<typeof isSessionActive>[0] & object> = {},
  ) => ({
    userId: 'user',
    revokedAt: null,
    expiresAt: new Date(now.getTime() + 1),
    ...changes,
  });

  it('rejects a session at exactly its expiry instant', () => {
    expect(isExpired(now, now)).toBe(true);
    expect(isSessionActive(session({ expiresAt: now }), 'user', now)).toBe(
      false,
    );
  });

  it('accepts a session one millisecond before expiry', () => {
    expect(isSessionActive(session(), 'user', now)).toBe(true);
  });

  it('rejects missing, foreign and revoked sessions', () => {
    expect(isSessionActive(null, 'user', now)).toBe(false);
    expect(isSessionActive(session(), 'other', now)).toBe(false);
    expect(isSessionActive(session({ revokedAt: now }), 'user', now)).toBe(
      false,
    );
  });
});
