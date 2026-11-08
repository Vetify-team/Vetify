import { describe, expect, it } from 'vitest';
import {
  hashResetToken,
  mayRequestReset,
  newResetToken,
  RESET_HOURLY_LIMIT,
  resetLink,
} from './password-reset.js';
import { escapeHtml, passwordResetEmail } from '../mail/templates.js';

const now = new Date('2026-11-08T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);

describe('password reset', () => {
  it('makes long random URL-safe tokens and stores only their hash', () => {
    const token = newResetToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newResetToken()).not.toBe(token);
    expect(hashResetToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashResetToken(token)).not.toContain(token);
  });

  it('puts the token in the fragment of the requesting site', () => {
    expect(resetLink('https://app.vetify.live', 'abc')).toBe(
      'https://app.vetify.live/restablecer-contrasena#abc',
    );
  });

  it('allows one email per minute and five per hour', () => {
    expect(mayRequestReset([], now)).toBe(true);
    expect(mayRequestReset([ago(30_000)], now)).toBe(false);
    expect(mayRequestReset([ago(61_000)], now)).toBe(true);
    const hour = Array.from({ length: RESET_HOURLY_LIMIT }, (_, i) =>
      ago(120_000 * (i + 1)),
    );
    expect(mayRequestReset(hour, now)).toBe(false);
    expect(mayRequestReset([ago(3_700_000)], now)).toBe(true);
  });

  it('escapes the user name in the email', () => {
    expect(escapeHtml('<b>"Ana" & Co\'</b>')).toBe(
      '&lt;b&gt;&quot;Ana&quot; &amp; Co&#39;&lt;/b&gt;',
    );
    const email = passwordResetEmail({
      name: '<script>x</script>',
      link: 'https://app.vetify.live/restablecer-contrasena#tok',
      minutes: 30,
    });
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain(
      'href="https://app.vetify.live/restablecer-contrasena#tok"',
    );
    expect(email.text).toContain('30 minutos');
  });
});
