import { Prisma } from '../generated/prisma/client.js';

/**
 * Lock the user's row. A database lock, shared by every API instance: READ
 * COMMITTED sees the preceding rotation/replay once it is acquired. Every
 * session writer and every keyed write takes it before touching session rows,
 * so a waiting request cannot resurrect a session revoked meanwhile.
 */
export async function lockUser(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`,
  );
}

/** A session is dead from its `expiresAt` instant on. */
export const isExpired = (expiresAt: Date, now = new Date()): boolean =>
  expiresAt <= now;

interface SessionState {
  userId: string;
  revokedAt: Date | null;
  expiresAt: Date;
}

/** The session exists, belongs to the user, is not revoked and has not expired. */
export const isSessionActive = (
  session: SessionState | null,
  userId: string,
  now = new Date(),
): boolean =>
  !!session &&
  session.userId === userId &&
  !session.revokedAt &&
  !isExpired(session.expiresAt, now);
