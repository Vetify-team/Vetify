import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import type { Env } from '../../config.js';
import { apiVersion } from './api-version.js';
import { noStore } from './no-store.js';

/** Shared by production bootstrap and HTTP security regression tests. */
export function configureHttp(
  app: NestExpressApplication,
  config: Pick<
    Env,
    'TRUST_PROXY_HOPS' | 'TRUST_PROXY_CIDRS' | 'ALLOWED_ORIGINS'
  >,
): void {
  if (config.TRUST_PROXY_CIDRS.length)
    app.set('trust proxy', config.TRUST_PROXY_CIDRS);
  else if (config.TRUST_PROXY_HOPS > 0)
    app.set('trust proxy', config.TRUST_PROXY_HOPS);
  app.disable('x-powered-by');
  // Errors from parsers must carry the same protections as normal responses.
  app.use(helmet());
  app.use('/api', noStore);
  app.useBodyParser('json', { limit: '100kb' });
  app.use(cookieParser());
  app.use(apiVersion);
  // Forms cannot establish sessions, even when Origin is stripped. JSON is
  // what the web/mobile clients already send. CORS alone is not CSRF defense.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      req.method === 'POST' &&
      /^\/api\/v\d+\/auth\/(login|register)\/?$/i.test(req.path) &&
      !req.is('application/json')
    ) {
      res.status(415).json({
        code: 'BAD_REQUEST',
        message: 'Session credentials must be sent as application/json',
      });
      return;
    }
    next();
  });
  app.enableCors({ origin: config.ALLOWED_ORIGINS, credentials: true });
}
