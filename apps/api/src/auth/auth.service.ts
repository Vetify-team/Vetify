import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import {
  idSchema,
  PLAN_PERIOD_DAYS,
  TERMS_VERSION,
  type AcceptClinicInvitation,
  type LogIn,
  type RegisterClinic,
  type Session,
  type SignUp,
  type TokenPayload,
  type User,
} from '@vetify/types';
import * as argon2 from 'argon2';
import type { Env } from '../config.js';
import { AppException, sessionExpired } from '../common/errors.js';
import { z } from 'zod';
import { Prisma, type User as UserRow } from '../generated/prisma/client.js';
import { MailService } from '../mail/mail.service.js';
import { welcomeEmail, type WelcomeInput } from '../mail/templates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ACCESS_AUDIENCE,
  ALGORITHM,
  ISSUER,
  REFRESH_AUDIENCE,
} from './tokens.js';
import { isExpired, lockUser } from './sessions.js';
import { notClinicMember } from '../clinics/clinics.service.js';
import { clinicSuspended } from '../clinics/link-codes.service.js';
import { SignupLinksService } from '../clinics/signup-links.service.js';
import { TeamService } from '../clinics/team.service.js';
import { extendPeriod } from '../billing/billing.logic.js';
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
  private readonly logger = new Logger(AuthService.name);
  /** Dummy hash so an unknown email takes as long as a wrong password. */
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly mail: MailService,
    private readonly team: TeamService,
    private readonly signupLinks: SignupLinksService,
  ) {}

  /** Public sign-up: owner accounts only (clinics register with a link). */
  async signUp(data: SignUp): Promise<IssuedSession> {
    const { user, session } = await this.createAccount(
      data.password,
      (tx, passwordHash) =>
        tx.user.create({
          data: {
            ...this.newAccount(data, passwordHash),
            email: data.email.toLowerCase(),
            role: 'owner',
          },
        }),
    );
    this.sendWelcome(user, {
      role: 'owner',
      name: user.name,
      link: this.config.get('OWNER_APP_URL', { infer: true }) || null,
    });
    return session;
  }

  /**
   * Registers a clinic with the link an admin issued: the account takes the
   * link's email and becomes the clinic's administrator. A paid plan starts
   * now, for one period (the admin confirmed the payment). The clinic starts
   * unverified: it cannot issue link codes until an admin reviews it.
   */
  async registerClinic(data: RegisterClinic): Promise<IssuedSession> {
    const { user, session } = await this.createAccount(
      data.password,
      async (tx, passwordHash) => {
        const link = await this.signupLinks.claim(tx, data.token);
        const created = await tx.user.create({
          data: {
            ...this.newAccount(data, passwordHash),
            email: link.email,
            role: 'clinic',
          },
        });
        const clinic = await tx.clinic.create({
          data: {
            name: data.clinicName,
            ...(link.plan === 'pilot'
              ? {}
              : {
                  plan: link.plan,
                  planUntil: extendPeriod(null, new Date(), PLAN_PERIOD_DAYS),
                }),
            staff: { create: { userId: created.id, role: 'admin' } },
          },
        });
        await tx.clinicSignupLink.update({
          where: { id: link.id },
          data: { usedClinicId: clinic.id },
        });
        return created;
      },
    );
    this.sendWelcome(user, {
      role: 'clinic',
      name: user.name,
      clinicName: data.clinicName,
    });
    return session;
  }

  /**
   * Creates the invited person's account, with the invited email and role,
   * and joins them to the clinic. The invitation is claimed in the same
   * transaction: an expired, revoked or reused link creates nothing.
   */
  async acceptInvitation(data: AcceptClinicInvitation): Promise<IssuedSession> {
    const { session } = await this.createAccount(
      data.password,
      async (tx, passwordHash) => {
        const invitation = await this.team.claim(tx, data.token);
        const created = await tx.user.create({
          data: {
            ...this.newAccount(data, passwordHash),
            email: invitation.email,
            role: 'clinic',
          },
        });
        await tx.clinicStaff.create({
          data: {
            clinicId: invitation.clinicId,
            userId: created.id,
            role: invitation.role,
          },
        });
        await tx.clinicInvitation.update({
          where: { id: invitation.id },
          data: { acceptedUserId: created.id },
        });
        return created;
      },
    );
    return session;
  }

  /** Fields every new account gets; the terms version is ours, not the client's. */
  private newAccount(
    data: { name: string; phone?: string },
    passwordHash: string,
  ) {
    return {
      name: data.name,
      phone: data.phone ?? null,
      passwordHash,
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: new Date(),
    };
  }

  /**
   * Hashes the password, runs `create` in a transaction (a link it claims is
   * spent only if the account commits) and opens the first session. A taken
   * email answers 409.
   */
  private async createAccount(
    password: string,
    create: (
      tx: Prisma.TransactionClient,
      passwordHash: string,
    ) => Promise<UserRow>,
  ): Promise<{ user: UserRow; session: IssuedSession }> {
    const passwordHash = await argon2.hash(password);
    let user: UserRow;
    try {
      user = await this.prisma.$transaction((tx) => create(tx, passwordHash));
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
    return { user, session: await this.issueSession(user) };
  }

  /**
   * Fire and forget, after the commit: a slow or failing Resend never delays
   * or fails the sign-up, and only the request that created the row gets
   * here (a retry hits the unique email first), so it is sent once. A failed
   * send is logged and not retried: the welcome carries nothing the account
   * needs.
   */
  private sendWelcome(user: UserRow, input: WelcomeInput): void {
    void this.mail
      .send({ to: user.email, ...welcomeEmail(input) })
      .catch((error: unknown) => this.logger.error(error));
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
      await lockUser(tx, payload.sub);
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
        await lockUser(tx, payload.sub);
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
      isExpired(session.expiresAt)
    )
      throw sessionExpired();
    return session;
  }

  private async issueSession(user: UserRow): Promise<IssuedSession> {
    return this.prisma.$transaction(async (tx) => {
      await lockUser(tx, user.id);
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

  private async issueSessionIn(
    tx: Prisma.TransactionClient,
    user: UserRow,
  ): Promise<IssuedSession> {
    // Every way into a session (sign-up, log-in, refresh) passes here, under
    // the user's lock. Suspending a clinic takes the same lock before
    // revoking, so a log-in racing it either sees it or has its session
    // revoked.
    // The same lock is taken when a member is removed from their clinic.
    if (user.role === 'clinic') {
      const staff = await tx.clinicStaff.findFirst({
        where: { userId: user.id },
        select: { clinic: { select: { suspendedAt: true } } },
      });
      if (!staff) throw notClinicMember();
      if (staff.clinic.suspendedAt) throw clinicSuspended();
    }
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
