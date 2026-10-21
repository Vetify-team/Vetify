import type { NextFunction, Request, Response } from 'express';

/**
 * API responses carry health and personal data: no browser, proxy or service
 * worker may store them. `Vary: Authorization, Cookie` keeps any cache that
 * ignores no-store from serving one user's response to another.
 */
export function noStore(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.append('Vary', 'Authorization, Cookie');
  next();
}
