import { createHash } from 'node:crypto';
import { HttpStatus } from '@nestjs/common';
import type { TokenPayload } from '@vetify/types';
import { AppException, badRequest, sessionExpired } from './errors.js';
import { isSessionActive, lockUser } from '../auth/sessions.js';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_RESULTS_PER_USER = 1000;
const MAX_RESULT_BYTES = 64 * 1024;

type Tx = Prisma.TransactionClient;

export interface IdempotentWrite<T, Access> {
  user: TokenPayload;
  /** Operation and resource, e.g. `recordConsultation:<petId>`. */
  scope: string;
  /** Raw `Idempotency-Key` header; undefined keeps ordinary POST semantics. */
  key: string | undefined;
  /** Validated body: its fingerprint detects a key reused with other data. */
  payload: unknown;
  authorize: (tx: Tx) => Promise<Access>;
  write: (tx: Tx, access: Access) => Promise<T>;
}

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

function assertKeyFormat(key: string | undefined): void {
  if (key !== undefined && !/^[A-Za-z0-9_-]{16,128}$/.test(key)) {
    throw badRequest(
      'Idempotency-Key must contain 16–128 letters, digits, underscores or hyphens',
    );
  }
}

/** Replays recheck the session: a revoked one must not read back saved results. */
async function assertSessionActive(tx: Tx, user: TokenPayload): Promise<void> {
  const session = await tx.refreshSession.findUnique({
    where: { id: user.sid },
  });
  if (!isSessionActive(session, user.sub)) throw sessionExpired();
}

/** Bound cleanup work per request; an operational job may also delete expired rows. */
async function pruneExpired(tx: Tx, now: Date): Promise<void> {
  await tx.$executeRaw(Prisma.sql`DELETE FROM idempotency_results WHERE (user_id, scope, key_hash) IN (
      SELECT user_id, scope, key_hash FROM idempotency_results WHERE expires_at <= ${now}
      ORDER BY expires_at LIMIT 100
    )`);
}

/** The saved response for this key, or null when there is none (or it expired). */
async function findReplay<T>(
  tx: Tx,
  id: { userId: string; scope: string; keyHash: string },
  fingerprint: string,
  now: Date,
): Promise<T | null> {
  const where = { userId_scope_keyHash: id };
  const previous = await tx.idempotencyResult.findUnique({ where });
  if (!previous) return null;
  if (previous.expiresAt <= now) {
    await tx.idempotencyResult.delete({ where });
    return null;
  }
  if (previous.fingerprint !== fingerprint) {
    throw new AppException(
      HttpStatus.CONFLICT,
      'IDEMPOTENCY_CONFLICT',
      'This Idempotency-Key was already used with different data',
    );
  }
  return previous.response as T;
}

async function assertQuota(tx: Tx, userId: string, now: Date): Promise<void> {
  const stored = await tx.idempotencyResult.count({
    where: { userId, expiresAt: { gt: now } },
  });
  if (stored >= MAX_RESULTS_PER_USER) {
    throw new AppException(
      HttpStatus.TOO_MANY_REQUESTS,
      'RATE_LIMITED',
      'The daily retry-result budget is exhausted',
    );
  }
}

async function storeResult(
  tx: Tx,
  id: { userId: string; scope: string; keyHash: string },
  fingerprint: string,
  result: unknown,
  now: Date,
): Promise<void> {
  const serialized = JSON.stringify(result);
  if (Buffer.byteLength(serialized) > MAX_RESULT_BYTES)
    throw badRequest('Retry result is too large');
  await tx.idempotencyResult.create({
    data: {
      ...id,
      fingerprint,
      response: JSON.parse(serialized) as Prisma.InputJsonValue,
      expiresAt: new Date(now.getTime() + RETENTION_MS),
    },
  });
}

/**
 * Run the write and persist its successful response in ONE transaction. User-row
 * locking serializes competing writes/quotas across API instances. Errors roll
 * back both. Authentication guards run first; authorization is rerun even for a
 * replay. A missing key preserves ordinary POST semantics for existing clients.
 */
export async function idempotentWrite<T, Access>(
  prisma: PrismaService,
  { user, scope, key, payload, authorize, write }: IdempotentWrite<T, Access>,
): Promise<T> {
  assertKeyFormat(key);
  return prisma.$transaction(
    async (tx) => {
      if (key === undefined) return write(tx, await authorize(tx));

      await lockUser(tx, user.sub);
      await assertSessionActive(tx, user);
      const access = await authorize(tx);

      const now = new Date();
      const id = { userId: user.sub, scope, keyHash: digest(key) };
      const fingerprint = digest(canonical(payload));
      await pruneExpired(tx, now);
      const replay = await findReplay<T>(tx, id, fingerprint, now);
      if (replay !== null) return replay;
      await assertQuota(tx, user.sub, now);

      const result = await write(tx, access);
      await storeResult(tx, id, fingerprint, result, now);
      return result;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 5000,
      timeout: 10000,
    },
  );
}
