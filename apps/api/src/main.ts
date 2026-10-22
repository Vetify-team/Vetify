import { randomBytes } from 'node:crypto';
import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import type { NextFunction, Request, Response } from 'express';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';
import { configureHttp } from './common/http/configure-http.js';
import { SCALAR_THEME } from './common/openapi/scalar-theme.js';
import { docsEnabled, type Env } from './config.js';
import { createOpenApiDocument } from './openapi.js';

/** Pinned Scalar bundle: the docs page never runs whatever "latest" is today. */
const SCALAR_CDN = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.75.1';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  const config = app.get(ConfigService<Env, true>);

  configureHttp(app, {
    TRUST_PROXY_HOPS: config.get('TRUST_PROXY_HOPS', { infer: true }),
    TRUST_PROXY_CIDRS: config.get('TRUST_PROXY_CIDRS', { infer: true }),
    ALLOWED_ORIGINS: config.get('ALLOWED_ORIGINS', { infer: true }),
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, prefix: 'v' });

  const docs = docsEnabled({
    NODE_ENV: config.get('NODE_ENV', { infer: true }),
    API_DOCS_ENABLED: config.get('API_DOCS_ENABLED', { infer: true }),
  });
  if (docs) {
    // OpenAPI at /api/docs-json and the Scalar reference at /api/docs.
    const document = createOpenApiDocument(app);
    SwaggerModule.setup('api/docs', app, document, {
      ui: false,
      raw: ['json'],
    });
    app.use('/api/docs', (req: Request, res: Response, next: NextFunction) => {
      if (req.path !== '/') return next();
      const nonce = randomBytes(16).toString('base64');
      res.setHeader(
        'Content-Security-Policy',
        [
          "default-src 'self'",
          `script-src 'nonce-${nonce}' https://cdn.jsdelivr.net`,
          "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
          "font-src 'self' data: https://cdn.jsdelivr.net",
          "img-src 'self' data:",
          "connect-src 'self'",
          "frame-ancestors 'none'",
          "base-uri 'none'",
          "object-src 'none'",
        ].join('; '),
      );
      apiReference({
        url: '/api/docs-json',
        cdn: SCALAR_CDN,
        nonce,
        pageTitle: 'Vetify API',
        theme: 'none',
        customCss: SCALAR_THEME,
        defaultHttpClient: { targetKey: 'js', clientKey: 'fetch' },
        // Only the reference: no toolbar, assistant, SDK generator or telemetry.
        showDeveloperTools: 'never',
        agent: { disabled: true },
        mcp: { disabled: true },
        telemetry: false,
      })(req, res);
    });
  }

  await app.listen(config.get('PORT', { infer: true }));
}

await bootstrap();
