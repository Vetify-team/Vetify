import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { TokenPayload } from '@vetify/types';
import * as argon2 from 'argon2';
import { AppException, forbidden, sessionExpired } from '../common/errors.js';
import { Prisma } from '../generated/prisma/client.js';
import { MailService } from '../mail/mail.service.js';
import { accountDeletedEmail } from '../mail/templates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { lockUser } from './sessions.js';

export const wrongPassword = () =>
  new AppException(
    HttpStatus.FORBIDDEN,
    'WRONG_PASSWORD',
    'The password is not correct',
  );

/**
 * Closes an owner's account. Deleting the `users` row is the whole erasure:
 * every table that holds the owner's data reaches it through ON DELETE
 * CASCADE, directly (sessions, reset links, payments, idempotency results,
 * notices, push subscriptions) or through their pets (record sections,
 * permissions, card links, reminders, anomalies, notices and their push and
 * email deliveries, and the pet's access log). See docs/SECURITY_HANDOFF.md.
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async delete(user: TokenPayload, password: string): Promise<void> {
    const row = await this.prisma.user.findUnique({ where: { id: user.sub } });
    if (!row) throw sessionExpired();
    // The controller already allows only owners; this keeps the service
    // from erasing a clinic or admin if it is ever reached another way.
    if (row.role !== 'owner') throw forbidden();
    if (!(await argon2.verify(row.passwordHash, password)))
      throw wrongPassword();

    await this.prisma.$transaction(
      async (tx) => {
        // Same lock as login, refresh and password reset: none of them can
        // issue a session for this account while it is being deleted.
        await lockUser(tx, row.id);
        const current = await tx.user.findUnique({ where: { id: row.id } });
        // A password reset that committed after the check above wins: the
        // verified password is no longer the account's.
        if (!current || current.passwordHash !== row.passwordHash)
          throw wrongPassword();
        await tx.user.delete({ where: { id: row.id } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );

    void this.mail
      .send({ to: row.email, ...accountDeletedEmail({ name: row.name }) })
      .catch((error: unknown) => this.logger.error(error));
  }
}
