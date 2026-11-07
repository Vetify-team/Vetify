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
