import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PASSWORD_RESET_MINUTES } from '@vetify/types';
import * as argon2 from 'argon2';
import { AppException } from '../common/errors.js';
import { Prisma } from '../generated/prisma/client.js';
import { MailService } from '../mail/mail.service.js';
import { passwordChangedEmail, passwordResetEmail } from '../mail/templates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  hashResetToken,
  mayRequestReset,
  newResetToken,
  RESET_TTL_MS,
  resetLink,
} from './password-reset.js';
import { isExpired, lockUser } from './sessions.js';

const HOUR_MS = 3_600_000;

const invalidToken = () =>
  new AppException(
    HttpStatus.BAD_REQUEST,
    'RESET_TOKEN_INVALID',
    'The reset link is invalid, expired or already used',
  );

/**
 * Password reset by email. A request emails a single-use link valid for
 * PASSWORD_RESET_MINUTES; using it sets the new password, spends every
 * other pending link and revokes every session of the account.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * Runs after the response is sent, so the answer and its timing are the
   * same whether or not the email has an account.
   */
  request(email: string, origin: string): void {
    void this.sendLink(email.toLowerCase(), origin).catch((error: unknown) =>
      this.logger.error(error),
    );
  }

  async reset(token: string, password: string): Promise<void> {
    const passwordHash = await argon2.hash(password);
    const tokenHash = hashResetToken(token);

    const user = await this.prisma.$transaction(
      async (tx) => {
        const reset = await tx.passwordReset.findUnique({
          where: { tokenHash },
          include: { user: true },
        });
        if (!reset || reset.usedAt || isExpired(reset.expiresAt)) return null;
        await lockUser(tx, reset.userId);
        const now = new Date();
        // Claim the link: two concurrent uses change the password once.
        const claimed = await tx.passwordReset.updateMany({
          where: { id: reset.id, usedAt: null },
          data: { usedAt: now },
        });
        if (claimed.count !== 1) return null;
        await tx.passwordReset.updateMany({
          where: { userId: reset.userId, usedAt: null },
          data: { usedAt: now },
        });
        await tx.user.update({
          where: { id: reset.userId },
          data: { passwordHash },
        });
        // Whoever knew the old password is logged out everywhere. A login
        // racing this one fails its password-hash check in issueSession.
        await tx.refreshSession.updateMany({
          where: { userId: reset.userId, revokedAt: null },
          data: { revokedAt: now },
        });
        return reset.user;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
    if (!user) throw invalidToken();

    void this.mail
      .send({ to: user.email, ...passwordChangedEmail({ name: user.name }) })
      .catch((error: unknown) => this.logger.error(error));
  }

  private async sendLink(email: string, origin: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;

    const now = new Date();
    const recent = await this.prisma.passwordReset.findMany({
      where: {
        userId: user.id,
        createdAt: { gt: new Date(now.getTime() - HOUR_MS) },
      },
      select: { createdAt: true },
    });
    if (
      !mayRequestReset(
        recent.map((row) => row.createdAt),
        now,
      )
    )
      return;

    const token = newResetToken();
    // Only the newest link works.
    await this.prisma.$transaction([
      this.prisma.passwordReset.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      }),
      this.prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash: hashResetToken(token),
          expiresAt: new Date(now.getTime() + RESET_TTL_MS),
        },
      }),
    ]);
    await this.mail.send({
      to: user.email,
      ...passwordResetEmail({
        name: user.name,
        link: resetLink(origin, token),
        minutes: PASSWORD_RESET_MINUTES,
      }),
    });
  }
}
