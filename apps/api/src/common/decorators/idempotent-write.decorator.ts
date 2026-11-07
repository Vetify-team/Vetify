import {
  applyDecorators,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import { ErrorResponses } from '../openapi/zod-openapi.js';

/** Documents the optional `Idempotency-Key` header and its 409/429 errors. */
export const IdempotentWrite = () =>
  applyDecorators(
    ErrorResponses(409, 429),
    ApiHeader({
      name: 'Idempotency-Key',
      required: false,
      description:
        '16–128 URL-safe characters. Reuse for the same write retry within 24 hours; different data returns 409.',
    }),
  );

/** The raw `Idempotency-Key` header; its format is checked by idempotentWrite. */
export const IdempotencyKey = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined =>
    context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>().headers[
      'idempotency-key'
    ],
);
