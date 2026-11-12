import type { Request } from 'express';

/** `sub` of a bearer JWT, read without verifying it (see accountTracker). */
function bearerSubject(authorization: unknown): string | null {
  if (typeof authorization !== 'string') return null;
  const match = /^Bearer ([^.\s]+)\.([^.\s]+)\.[^.\s]+$/.exec(authorization);
  if (!match) return null;
  try {
    const payload: unknown = JSON.parse(
      Buffer.from(match[2], 'base64url').toString('utf8'),
    );
    const sub = (payload as { sub?: unknown } | null)?.sub;
    return typeof sub === 'string' && sub.length <= 64 ? sub : null;
  } catch {
    return null;
  }
}

/**
 * Key of the per-account limiter: the email in the body (log-in, reset),
 * else the user of the bearer token, else the client IP.
 *
 * The throttler runs before the JWT guard, so the token is not verified
 * here. That is safe for keying: a forged `sub` changes the bucket, but the
 * JWT guard then rejects the request, so only a validly signed token, whose
 * `sub` is fixed, ever reaches a handler under its own bucket.
 */
export const accountTracker = (req: Record<string, unknown>): string => {
  const request = req as unknown as Request;
  const email = request.body?.email;
  if (typeof email === 'string') return `account:${email.trim().toLowerCase()}`;
  const sub = bearerSubject(request.headers?.authorization);
  return sub ? `user:${sub}` : `ip:${String(request.ip)}`;
};
