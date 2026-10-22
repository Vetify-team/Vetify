import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiError, ErrorCode, ErrorReason } from '@vetify/types';

/**
 * Error with a stable `code` that clients translate. Services throw these;
 * the global filter turns them into an `ApiError` body.
 */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ErrorCode,
    message: string,
    readonly details: Pick<ApiError, 'errors' | 'reason'> = {},
  ) {
    super({ code, message, ...details } satisfies ApiError, status);
  }
}

export const notFound = (message = 'Not found') =>
  new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', message);

export const forbidden = (message = 'You are not allowed to do this') =>
  new AppException(HttpStatus.FORBIDDEN, 'FORBIDDEN', message);

export const badRequest = (message: string, reason?: ErrorReason) =>
  new AppException(
    HttpStatus.BAD_REQUEST,
    'BAD_REQUEST',
    message,
    reason ? { reason } : {},
  );

export const sessionExpired = () =>
  new AppException(
    HttpStatus.UNAUTHORIZED,
    'SESSION_EXPIRED',
    'The session expired. Log in again.',
  );
