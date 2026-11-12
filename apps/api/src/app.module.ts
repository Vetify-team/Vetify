import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import type { TokenPayload } from '@vetify/types';
import type { Request } from 'express';

import { AccessLogInterceptor } from './access-log/access-log.interceptor.js';
import { AccessLogModule } from './access-log/access-log.module.js';
import { AdminModule } from './admin/admin.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BillingModule } from './billing/billing.module.js';
import { ClinicsModule } from './clinics/clinics.module.js';
import { FilesModule } from './files/files.module.js';
import { accountTracker } from './common/http/account-tracker.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { validateEnv } from './config.js';
import { HealthController } from './health/health.controller.js';
import { PermissionsModule } from './permissions/permissions.module.js';
import { PetsModule } from './pets/pets.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RecordsModule } from './records/records.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRoot({
      pinoHttp: {
        // Readable in development; JSON in production for the hosting logs.
        transport:
          process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        // A fresh id per request, returned as X-Request-Id so a user's
        // report can be matched to its log lines. A client-sent id is not
        // trusted: it would let a caller forge or inject log entries.
        genReqId: (_req, res) => {
          const id = randomUUID();
          res.setHeader('X-Request-Id', id);
          return id;
        },
        // Who made the request (once the auth guard ran). Ids, not emails.
        customProps: (req) => {
          const user = (req as Request & { user?: TokenPayload }).user;
          return user ? { userId: user.sub, role: user.role } : {};
        },
        // The platform's liveness probe would drown the real traffic.
        autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
        // Credentials never reach the logs.
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          'req.body.password',
        ],
      },
    }),
    // `general` is per client IP (needs TRUST_PROXY_HOPS behind a proxy).
    // `account` is per email (or per token user), so a credential endpoint
    // cannot be brute forced from many IPs; it is high by default and tightened with
    // @Throttle() on those endpoints. Both live in memory: a single instance
    // is assumed (move to Redis before scaling out).
    ThrottlerModule.forRoot([
      { name: 'general', ttl: 60_000, limit: 120 },
      {
        name: 'account',
        ttl: 60_000,
        limit: 1_000,
        getTracker: accountTracker,
      },
    ]),
    PrismaModule,
    AccessLogModule,
    AuthModule,
    PetsModule,
    RecordsModule,
    FilesModule,
    PermissionsModule,
    ClinicsModule,
    AdminModule,
    BillingModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: rate limit, then identity (JWT), then role.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: AccessLogInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
