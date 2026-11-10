import { createHash, randomBytes } from 'node:crypto';
import { PASSWORD_RESET_MINUTES } from '@vetify/types';

/** How long an emailed link works. */
export const RESET_TTL_MS = PASSWORD_RESET_MINUTES * 60_000;
/** At most one email per minute and five per hour for each account. */
export const RESET_COOLDOWN_MS = 60_000;
export const RESET_HOURLY_LIMIT = 5;
const HOUR_MS = 3_600_000;

/** 256 random bits, URL-safe: the secret that travels in the link. */
export const newResetToken = (): string =>
  randomBytes(32).toString('base64url');

/** Stored instead of the token. Random tokens need no slow hash. */
export const hashResetToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

/**
 * The page that sets the new password. The token goes in the #fragment:
 * browsers never send it to a server or in a Referer header.
 */
export const resetLink = (origin: string, token: string): string =>
  `${origin}/restablecer-contrasena#${token}`;

/**
 * Whether the account may get another email, given when its recent links
 * were created. Stops a stranger from flooding someone's inbox.
 */
export function mayRequestReset(createdAt: Date[], now = new Date()): boolean {
  const lastHour = createdAt.filter(
    (date) => now.getTime() - date.getTime() < HOUR_MS,
  );
  if (lastHour.length >= RESET_HOURLY_LIMIT) return false;
  return lastHour.every(
    (date) => now.getTime() - date.getTime() >= RESET_COOLDOWN_MS,
  );
}
