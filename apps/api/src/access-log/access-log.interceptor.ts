import {
  CallHandler,
  ExecutionContext,
  Injectable,
  SetMetadata,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { TokenPayload } from '@vetify/types';
import { concatMap, from, type Observable } from 'rxjs';
import { AccessLogService } from './access-log.service.js';

const ACCESS_ACTION = 'vetify:access-action';

interface ActionMetadata {
  action: string;
  dedupe: boolean;
}

/**
 * Names the action written to the access log. Reads pass `{ dedupe: true }`.
 * Without it the action is "METHOD path".
 */
export const LogAccess = (action: string, options: { dedupe?: boolean } = {}) =>
  SetMetadata(ACCESS_ACTION, {
    action,
    dedupe: options.dedupe ?? false,
  } satisfies ActionMetadata);

/**
 * Global interceptor: every request to a route with `:petId` is written to
 * `access_logs`, so no endpoint depends on someone remembering to log.
 *
 * - On success, the response waits until the entry is stored.
 * - Denials are handled by the global filter, including guard failures.
 */
@Injectable()
export class AccessLogInterceptor implements NestInterceptor {
  constructor(
    private readonly accessLog: AccessLogService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      params?: Record<string, string>;
      method: string;
      route?: { path?: string };
      user?: TokenPayload;
    }>();

    const petId = request.params?.petId;
    if (!petId) return next.handle();

    const metadata = this.reflector.get<ActionMetadata | undefined>(
      ACCESS_ACTION,
      context.getHandler(),
    );
    const action =
      metadata?.action ??
      `${request.method} ${request.route?.path ?? ''}`.trim();
    const userId = request.user?.sub ?? null;

    return next.handle().pipe(
      concatMap((response) =>
        from(
          this.accessLog
            .record({
              petIds: [petId],
              userId,
              action,
              dedupe: metadata?.dedupe,
            })
            .then(() => response),
        ),
      ),
    );
  }
}
