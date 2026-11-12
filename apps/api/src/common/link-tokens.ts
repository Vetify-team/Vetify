import { createHash, randomBytes } from 'node:crypto';

/**
 * Secrets that travel in emailed links (team invitations, clinic sign-up):
 * 256 random bits, URL-safe. Only the SHA-256 is stored; random tokens need
 * no slow hash. Links carry them in the #fragment, which browsers never send
 * to a server or in a Referer header.
 */
export const newLinkToken = (): string => randomBytes(32).toString('base64url');

export const hashLinkToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
