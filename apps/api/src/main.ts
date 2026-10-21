import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';
import type { Entorno } from './configuracion.js';
import { crearDocumentoOpenApi } from './openapi.js';
import { TEMA_SCALAR } from './common/openapi/tema-scalar.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService<Entorno, true>);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.get('CORS_ORIGIN', { infer: true }),
    credentials: true,
  });

  // La validación de entrada la hace ZodValidationPipe con los esquemas de
  // @vetify/types, endpoint por endpoint. No se usa el ValidationPipe de Nest
  // porque depende de class-validator y el contrato ya está definido en Zod.

  // OpenAPI en /api/docs-json y la referencia interactiva de Scalar en /api/docs.
  const documento = crearDocumentoOpenApi(app);
  SwaggerModule.setup('api/docs', app, documento, { ui: false, raw: ['json'] });
  app.use(
    '/api/docs',
    apiReference({
      url: '/api/docs-json',
      pageTitle: 'Vetify API',
      theme: 'none',
      customCss: TEMA_SCALAR,
      defaultHttpClient: { targetKey: 'js', clientKey: 'fetch' },
      // Solo la referencia: sin barra de herramientas, asistente, generador
      // de SDK ni telemetría de la plataforma de Scalar.
      showDeveloperTools: 'never',
      agent: { disabled: true },
      mcp: { disabled: true },
      telemetry: false,
    }),
  );

  const puerto = config.get('PORT', { infer: true });
  await app.listen(puerto);
}

await bootstrap();
