import { createHash } from 'node:crypto';
import { HttpStatus } from '@nestjs/common';
import type { TokenPayload } from '@vetify/types';
import { AppException, badRequest, sessionExpired } from './errors.js';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_RESULTS_PER_USER = 1000;

/** Canonical validated JSON: object insertion order and unknown fields do not change intent. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');

/**
 * Run the write and persist its successful response in ONE transaction. User-row
 * locking serializes competing writes/quotas across API instances. Errors roll
 * back both. Authentication guards run first; authorization is rerun even for a
 * replay. A missing key preserves ordinary POST semantics for existing clients.
 */
export async function idempotentWrite<T, Access>(
  prisma: PrismaService,
  user: TokenPayload,
  scope: string,
  key: string | undefined,
  payload: unknown,
  authorize: (tx: Prisma.TransactionClient) => Promise<Access>,
  write: (tx: Prisma.TransactionClient, access: Access) => Promise<T>,
): Promise<T> {
  if (key !== undefined && !/^[A-Za-z0-9_-]{16,128}$/.test(key)) {
    throw badRequest(
      'Idempotency-Key must contain 16–128 letters, digits, underscores or hyphens',
    );
  }
  const userId = user.sub;
  const keyHash = key === undefined ? undefined : digest(key);
  const fingerprint = digest(canonical(payload));
  return prisma.$transaction(
    async (tx) => {
      if (keyHash) {
        // Shared with session revocation so a waiting request cannot resurrect a
        // revoked session by replaying an earlier successful write.
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`,
        );
      }
      if (keyHash) {
        const session = await tx.refreshSession.findUnique({
          where: { id: user.sid },
        });
        if (
          !session ||
          session.userId !== userId ||
          session.revokedAt ||
          session.expiresAt <= new Date()
        ) {
          throw sessionExpired();
        }
      }
      const access = await authorize(tx);
      if (!keyHash) return write(tx, access);
      const now = new Date();
      // Bound cleanup work per request; an operational job may also delete expired rows.
      await tx.$executeRaw(Prisma.sql`DELETE FROM idempotency_results WHERE (user_id, scope, key_hash) IN (
      SELECT user_id, scope, key_hash FROM idempotency_results WHERE expires_at <= ${now}
      ORDER BY expires_at LIMIT 100
    )`);
      const where = { userId_scope_keyHash: { userId, scope, keyHash } };
      let previous = await tx.idempotencyResult.findUnique({ where });
      if (previous && previous.expiresAt <= now) {
        await tx.idempotencyResult.delete({ where });
        previous = null;
      }
      if (previous) {
        if (previous.fingerprint !== fingerprint) {
          throw new AppException(
            HttpStatus.CONFLICT,
            'IDEMPOTENCY_CONFLICT',
            'This Idempotency-Key was already used with different data',
          );
        }
        return previous.response as T;
      }
      if (
        (await tx.idempotencyResult.count({
          where: { userId, expiresAt: { gt: now } },
        })) >= MAX_RESULTS_PER_USER
      ) {
        throw new AppException(
          HttpStatus.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          'The daily retry-result budget is exhausted',
        );
      }
      const result = await write(tx, access);
      const serialized = JSON.stringify(result);
      if (Buffer.byteLength(serialized) > 64 * 1024)
        throw badRequest('Retry result is too large');
      await tx.idempotencyResult.create({
        data: {
          userId,
          scope,
          keyHash,
          fingerprint,
          response: JSON.parse(serialized) as Prisma.InputJsonValue,
          expiresAt: new Date(now.getTime() + RETENTION_MS),
        },
      });
      return result;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 5000,
      timeout: 10000,
    },
  );
}
