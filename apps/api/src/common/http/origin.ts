import { HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { AppException } from '../errors.js';

/**
 * CSRF defense for the endpoints that act on the session cookie. The cookie
 * is SameSite=Strict already; on top of that, a browser request must come
 * from an allowed origin. Non-browser clients send no Origin header.
 */
export function assertAllowedOrigin(req: Request, allowed: string[]): void {
  const origin = req.header('origin');
  const site = req.header('sec-fetch-site');
  // Sandboxed forms can send Origin: null; privacy settings can omit it.
  // Never allow a browser-declared cross-site request to bypass the check
  // by omitting Origin. CLI clients without browser headers remain supported.
  if (
    (origin && !allowed.includes(origin)) ||
    (!origin && site === 'cross-site')
  ) {
    throw new AppException(
      HttpStatus.FORBIDDEN,
      'INVALID_ORIGIN',
      'This request must come from the Vetify app',
    );
  }
}

/**
 * For responses that send the browser back to our site (emailed links,
 * payment redirects): the Origin must be present and one of ours, because
 * the URL is built from it.
 */
export function requireAllowedOrigin(req: Request, allowed: string[]): string {
  const origin = req.header('origin');
  if (!origin || !allowed.includes(origin)) {
    throw new AppException(
      HttpStatus.FORBIDDEN,
      'INVALID_ORIGIN',
      'This request must come from the Vetify app',
    );
  }
  return origin;
}

/**
 * The request's Origin when it is one of ours, else null. For links in
 * emails that are useful but not required: without a trusted origin the
 * email goes out without the link.
 */
export function trustedOrigin(req: Request, allowed: string[]): string | null {
  const origin = req.header('origin');
  return origin && allowed.includes(origin) ? origin : null;
}
