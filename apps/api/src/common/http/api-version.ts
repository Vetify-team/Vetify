import type { NextFunction, Request, Response } from 'express';
import type { ApiError } from '@vetify/types';

export const SUPPORTED_VERSIONS = ['1'] as const;
export const VERSION_HEADER = 'x-api-version';

/** Paths under /api that are not versioned resources. */
const UNVERSIONED = /^\/api\/(docs|docs-json)(\/|$|\?)/;
const VERSIONED = /^\/api\/v(\d+)(\/|$|\?)/;

const unsupported = (res: Response, message: string) =>
  res
    .status(400)
    .json({ code: 'API_VERSION_UNSUPPORTED', message } satisfies ApiError);

/**
 * The API is versioned in the URL (`/api/v1/pets`) and also accepts the
 * version in a header (`/api/pets` + `X-API-Version: 1`). The header form is
 * rewritten to the URL form before routing, so each controller is declared
 * once. If both are present they must agree.
 */
export function apiVersion(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.url.startsWith('/api/') || UNVERSIONED.test(req.url)) return next();

  const header = req.header(VERSION_HEADER)?.trim();
  const inUrl = VERSIONED.exec(req.url)?.[1];

  if (inUrl) {
    if (header && header !== inUrl) {
      unsupported(
        res,
        `X-API-Version (${header}) does not match the URL (v${inUrl})`,
      );
      return;
    }
    res.setHeader('X-API-Version', inUrl);
    return next();
  }

  if (!header) {
    unsupported(
      res,
      'Specify the version in the URL (/api/v1/...) or in the X-API-Version header',
    );
    return;
  }
  if (
    !SUPPORTED_VERSIONS.includes(header as (typeof SUPPORTED_VERSIONS)[number])
  ) {
    unsupported(
      res,
      `Unsupported API version: ${header}. Supported: ${SUPPORTED_VERSIONS.join(', ')}`,
    );
    return;
  }

  req.url = `/api/v${header}${req.url.slice('/api'.length)}`;
  res.setHeader('X-API-Version', header);
  next();
}
