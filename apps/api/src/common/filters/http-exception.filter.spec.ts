import {
  ArgumentsHost,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { describe, expect, it, vi } from 'vitest';
import { AppException, badRequest } from '../errors.js';
import { HttpExceptionFilter } from './http-exception.filter.js';
import type { AccessLogService } from '../../access-log/access-log.service.js';

// The filter logs unexpected errors; keep the test output clean.
vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

const respond = async (
  exception: unknown,
  request = {},
  recordDenied = vi.fn().mockResolvedValue(undefined),
) => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => request }),
  } as unknown as ArgumentsHost;
  await new HttpExceptionFilter({
    recordDenied,
  } as unknown as AccessLogService).catch(exception, host);
  return {
    status: res.status.mock.calls[0]?.[0],
    body: res.json.mock.calls[0]?.[0],
  };
};

describe('HttpExceptionFilter', () => {
  it('keeps the code of an AppException', async () => {
    expect(
      await respond(new AppException(409, 'EMAIL_TAKEN', 'taken')),
    ).toEqual({
      status: 409,
      body: { code: 'EMAIL_TAKEN', message: 'taken' },
    });
  });

  it('passes a business-rule reason through for clients to word', async () => {
    expect(
      await respond(
        badRequest('The end cannot be before the start', 'END_BEFORE_START'),
      ),
    ).toEqual({
      status: 400,
      body: {
        code: 'BAD_REQUEST',
        message: 'The end cannot be before the start',
        reason: 'END_BEFORE_START',
      },
    });
  });

  it('maps Nest exceptions to codes', async () => {
    expect((await respond(new ForbiddenException())).body.code).toBe(
      'FORBIDDEN',
    );
    expect((await respond(new NotFoundException())).body.code).toBe(
      'NOT_FOUND',
    );
    expect(await respond(new ThrottlerException())).toMatchObject({
      status: 429,
      body: { code: 'RATE_LIMITED' },
    });
  });

  it('answers 413 for a body that is too large, not 500', async () => {
    const tooLarge = Object.assign(new Error('request entity too large'), {
      status: 413,
      type: 'entity.too.large',
    });
    expect(await respond(tooLarge)).toMatchObject({
      status: 413,
      body: { code: 'PAYLOAD_TOO_LARGE' },
    });
  });

  it('never leaks the details of an unexpected error', async () => {
    const { status, body } = await respond(
      new Error('relation "users" does not exist'),
    );
    expect(status).toBe(500);
    expect(body).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Unexpected error',
    });
  });

  it.each([403, 404])(
    'audits an authenticated %s without changing its public status',
    async (status) => {
      const petId = '11111111-1111-4111-8111-111111111111';
      const recordDenied = vi.fn().mockResolvedValue(undefined);
      const error =
        status === 403 ? new ForbiddenException() : new NotFoundException();
      expect(
        await respond(
          error,
          { params: { petId }, user: { sub: 'actor' } },
          recordDenied,
        ),
      ).toMatchObject({ status });
      expect(recordDenied).toHaveBeenCalledExactlyOnceWith(petId, 'actor');
    },
  );

  it('does not turn audit-storage failure into disclosure or a changed denial', async () => {
    const recordDenied = vi
      .fn()
      .mockRejectedValue(new Error('database unavailable'));
    const result = await respond(
      new NotFoundException(),
      {
        params: { petId: '11111111-1111-4111-8111-111111111111' },
        user: { sub: 'actor' },
      },
      recordDenied,
    );
    expect(result).toMatchObject({ status: 404 });
  });

  it('does not query the database for invalid identifiers or anonymous denials', async () => {
    const recordDenied = vi.fn();
    await respond(
      new ForbiddenException(),
      { params: { petId: 'invalid' }, user: { sub: 'actor' } },
      recordDenied,
    );
    await respond(
      new ForbiddenException(),
      { params: { petId: '11111111-1111-4111-8111-111111111111' } },
      recordDenied,
    );
    expect(recordDenied).not.toHaveBeenCalled();
  });
});
