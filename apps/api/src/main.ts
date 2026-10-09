import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';
import type { Entorno } from './configuracion.js';

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

  const documento = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Vetify API')
      .setDescription(
        'Expediente clínico compartido de mascotas. El expediente pertenece al dueño; ' +
          'una clínica accede solo con un permiso activo y todo acceso queda en bitácora.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api/docs', app, documento);

  const puerto = config.get('PORT', { infer: true });
  await app.listen(puerto);
}

await bootstrap();
