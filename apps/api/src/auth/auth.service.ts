import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import type { LogIn, Session, SignUp, TokenPayload, User } from '@vetify/types';
import * as argon2 from 'argon2';
import type { Env } from '../config.js';
import { AppException, sessionExpired } from '../common/errors.js';
import { idSchema } from '@vetify/types';
import { z } from 'zod';
import { Prisma, type User as UserRow } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ACCESS_AUDIENCE,
  ALGORITHM,
  ISSUER,
  REFRESH_AUDIENCE,
} from './tokens.js';
import { toUser } from './user.mapper.js';

interface RefreshPayload {
  sub: string;
  /** id of the row in `refresh_sessions` */
  sid: string;
}

const refreshPayloadSchema = z.object({ sub: idSchema, sid: idSchema });
const SESSION_TRANSACTION = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
};

/** What a log-in produces: the session for the body and the cookie value. */
export interface IssuedSession {
  session: Session;
  refreshToken: string;
  refreshExpiresAt: Date;
}

/** The refresh token is random and signed: a fast hash is enough to not store it in clear. */
const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

/**
 * Sign-up, log-in, rotated refresh and log-out. Passwords use argon2.
 *
 * The refresh token is a JWT naming its session. Only its hash is stored and
 * every refresh revokes the used session and opens a new one. A token of an
 * already-rotated session means someone replayed it: all sessions of the user
 * are revoked.
 */
@Injectable()
export class AuthService {
  /** Dummy hash so an unknown email takes as long as a wrong password. */
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async signUp(data: SignUp): Promise<IssuedSession> {
    const passwordHash = await argon2.hash(data.password);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: data.email.toLowerCase(),
            name: data.name,
            phone: data.phone ?? null,
            role: data.role,
            passwordHash,
          },
        });
        if (data.role === 'clinic' && data.clinicName) {
          // New clinics start unverified: they cannot issue link codes, so
          // nobody can share a record with them until an admin reviews them.
          await tx.clinic.create({
            data: {
              name: data.clinicName,
              staff: { create: { userId: created.id, position: 'admin' } },
            },
          });
        }
        return created;
      });

      return this.issueSession(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'EMAIL_TAKEN',
          'An account with that email already exists',
        );
      }
      throw error;
    }
  }

  async logIn(data: LogIn): Promise<IssuedSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    this.dummyHash ??= argon2.hash('dummy-password-for-timing');
    const hash = user?.passwordHash ?? (await this.dummyHash);
    const valid = await argon2.verify(hash, data.password);

    if (!user || !valid) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'Wrong email or password',
      );
    }
    return this.issueSession(user);
  }

  async refresh(refreshToken: string | undefined): Promise<IssuedSession> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const issued = await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, payload.sub);
      const session = await this.validateRefresh(tx, payload, refreshToken!);
      if (session.revokedAt) {
        await tx.refreshSession.updateMany({
          where: { userId: session.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        // Return rather than throw: revocation must COMMIT before the 401.
        return null;
      }
      await tx.refreshSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      return this.issueSessionIn(tx, session.user);
    }, SESSION_TRANSACTION);
    if (!issued) throw sessionExpired();
    return issued;
  }

  /** Revoke this session, or every session when a rotated cookie is used. */
  async logOut(refreshToken: string | undefined): Promise<void> {
    try {
      const payload = await this.verifyRefreshToken(refreshToken);
      await this.prisma.$transaction(async (tx) => {
        await this.lockUser(tx, payload.sub);
        const session = await this.validateRefresh(tx, payload, refreshToken!);
        // If rotation won the race, also revoke its successor. The old cookie
        // must not leave a newly rotated device authenticated after logout.
        await tx.refreshSession.updateMany({
          where: {
            userId: session.userId,
            ...(session.revokedAt ? {} : { id: session.id }),
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
      }, SESSION_TRANSACTION);
    } catch (error) {
      if (!(error instanceof AppException)) throw error;
    }
  }

  async me(user: TokenPayload): Promise<User> {
    const row = await this.prisma.user.findUnique({ where: { id: user.sub } });
    if (!row) throw sessionExpired();
    return toUser(row);
  }

  private async verifyRefreshToken(
    refreshToken: string | undefined,
  ): Promise<RefreshPayload> {
    if (!refreshToken) throw sessionExpired();

    try {
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        algorithms: [ALGORITHM],
        issuer: ISSUER,
        audience: REFRESH_AUDIENCE,
      });
      return refreshPayloadSchema.parse(payload);
    } catch {
      throw sessionExpired();
    }
  }

  private async validateRefresh(
    tx: Prisma.TransactionClient,
    payload: RefreshPayload,
    refreshToken: string,
  ) {
    const session = await tx.refreshSession.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });

    const received = Buffer.from(hashToken(refreshToken));
    const matches =
      !!session &&
      session.tokenHash.length === received.length &&
      timingSafeEqual(Buffer.from(session.tokenHash), received);

    if (
      !session ||
      session.userId !== payload.sub ||
      !matches ||
      session.expiresAt < new Date()
    )
      throw sessionExpired();
    return session;
  }

  private async issueSession(user: UserRow): Promise<IssuedSession> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, user.id);
      // Read current roles under the same lock as session issuance.
      const current = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      // Password verification happened before this lock. A concurrent admin
      // promotion/password reset must not turn stale credentials into a new
      // privileged session after that operation revoked the old sessions.
      if (
        current.passwordHash !== user.passwordHash ||
        current.role !== user.role
      ) {
        throw sessionExpired();
      }
      return this.issueSessionIn(tx, current);
    }, SESSION_TRANSACTION);
  }

  private async lockUser(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<void> {
    // A database lock, shared by every API instance. READ COMMITTED sees the
    // preceding rotation/replay once this lock is acquired. All session
    // writers take this lock before reading or changing session rows.
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`,
    );
  }

  private async issueSessionIn(
    tx: Prisma.TransactionClient,
    user: UserRow,
  ): Promise<IssuedSession> {
    const sid = randomUUID();
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sid,
    };
    const common: JwtSignOptions = { algorithm: ALGORITHM, issuer: ISSUER };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        ...common,
        audience: ACCESS_AUDIENCE,
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_ACCESS_TTL', {
          infer: true,
        }) as JwtSignOptions['expiresIn'],
      }),
      this.jwt.signAsync({ sub: user.id, sid } satisfies RefreshPayload, {
        ...common,
        audience: REFRESH_AUDIENCE,
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_REFRESH_TTL', {
          infer: true,
        }) as JwtSignOptions['expiresIn'],
      }),
    ]);

    const accessExp = this.jwt.decode<{ exp: number }>(accessToken).exp;
    const refreshExpiresAt = new Date(
      this.jwt.decode<{ exp: number }>(refreshToken).exp * 1000,
    );

    // The session row must exist before the access token is used: the JWT
    // strategy checks it on every request.
    await tx.refreshSession.create({
      data: {
        id: sid,
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      session: {
        accessToken,
        accessTokenExpiresAt: new Date(accessExp * 1000).toISOString(),
        user: toUser(user),
      },
      refreshToken,
      refreshExpiresAt,
    };
  }
}
