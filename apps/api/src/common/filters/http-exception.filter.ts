import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import {
  idSchema,
  type ApiError,
  type ErrorCode,
  type TokenPayload,
} from '@vetify/types';
import type { Request } from 'express';
import { AccessLogService } from '../../access-log/access-log.service.js';
import type { Response } from 'express';
import { AppException } from '../errors.js';

const CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'RATE_LIMITED',
};

/** body-parser and other http-errors carry a numeric `status`, not HttpException. */
const clientErrorStatus = (error: unknown): number | null => {
  const status = (error as { status?: unknown; statusCode?: unknown })?.status;
  return typeof status === 'number' && status >= 400 && status < 500
    ? status
    : null;
};

/**
 * Every error leaves the API as an `ApiError`: `{ code, message, errors? }`.
 * Unexpected errors are logged and answered with a generic 500, never with
 * the stack or the database error.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly accessLog: AccessLogService) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.toApiError(exception);

    const request = host
      .switchToHttp()
      .getRequest<Request & { user?: TokenPayload }>();
    const petId = request.params?.petId;
    if (
      (status === 403 || status === 404) &&
      request.user &&
      idSchema.safeParse(petId).success
    ) {
      // Guards execute before interceptors. Log here without altering the
      // response (especially the 404 hiding another owner's pet).
      await this.accessLog
        .recordDenied(petId as string, request.user.sub)
        .catch((error: unknown) => {
          this.logger.error(error);
        });
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR)
      this.logger.error(exception);
    response.status(status).json(body);
  }

  private toApiError(exception: unknown): { status: number; body: ApiError } {
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        body: exception.getResponse() as ApiError,
      };
    }
    if (exception instanceof ThrottlerException) {
      return {
        status: HttpStatus.TOO_MANY_REQUESTS,
        body: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Try again in a minute.',
        },
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const message =
        typeof raw === 'string'
          ? raw
          : [(raw as { message?: string | string[] }).message]
              .flat()
              .join('. ') || exception.message;
      return {
        status,
        body: { code: CODE_BY_STATUS[status] ?? 'INTERNAL_ERROR', message },
      };
    }
    const status = clientErrorStatus(exception);
    if (status) {
      return {
        status,
        body: {
          code: CODE_BY_STATUS[status] ?? 'BAD_REQUEST',
          message:
            status === 413
              ? 'The request body is too large'
              : 'Malformed request',
        },
      };
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: 'INTERNAL_ERROR', message: 'Unexpected error' },
    };
  }
}
