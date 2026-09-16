import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { validarEntorno } from './configuracion.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { FiltroDeExcepciones } from './common/filters/excepciones.filter.js';
import { RolesGuard } from './common/guards/roles.guard.js';

import { AuthModule } from './auth/auth.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';
import { MascotasModule } from './mascotas/mascotas.module.js';
import { ExpedienteModule } from './expediente/expediente.module.js';
import { PermisosModule } from './permisos/permisos.module.js';
import { ClinicasModule } from './clinicas/clinicas.module.js';
import { IaModule } from './ia/ia.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validarEntorno }),
    LoggerModule.forRoot({
      pinoHttp: {
        // En desarrollo se ve legible; en producción sale JSON para Render.
        transport:
          process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        redact: ['req.headers.authorization', 'req.body.contrasena'],
      },
    }),
    // Límite general. Login, registro y verificación de QR llevan uno más
    // estricto con @Throttle() en su propio controlador.
    ThrottlerModule.forRoot([{ name: 'general', ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    UsuariosModule,
    MascotasModule,
    ExpedienteModule,
    PermisosModule,
    ClinicasModule,
    IaModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: FiltroDeExcepciones },
  ],
})
export class AppModule {}
