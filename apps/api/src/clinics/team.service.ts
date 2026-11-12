import { createHash, randomBytes } from 'node:crypto';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  CLINIC_INVITATION_DAYS,
  type ClinicInvitation,
  type ClinicInvitationPreview,
  type ClinicMember,
  type CreateClinicInvitation,
} from '@vetify/types';
import { lockUser } from '../auth/sessions.js';
import { toIsoDateTime } from '../common/dates.js';
import { AppException, badRequest, notFound } from '../common/errors.js';
import type {
  ClinicInvitation as InvitationRow,
  Prisma,
} from '../generated/prisma/client.js';
import { MailService } from '../mail/mail.service.js';
import { clinicInvitationEmail } from '../mail/templates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClinicsService } from './clinics.service.js';
import { clinicSuspended } from './link-codes.service.js';

export const INVITATION_TTL_MS = CLINIC_INVITATION_DAYS * 86_400_000;

/** Stored instead of the token. 256 random bits need no slow hash. */
export const hashInvitationToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

/** The token goes in the #fragment: never sent to a server or a Referer. */
export const invitationLink = (origin: string, token: string): string =>
  `${origin}/invitacion#${token}`;

export const invitationInvalid = () =>
  new AppException(
    HttpStatus.BAD_REQUEST,
    'INVITATION_INVALID',
    'The invitation is invalid, expired, revoked or already used',
  );

const emailTaken = () =>
  new AppException(
    HttpStatus.CONFLICT,
    'EMAIL_TAKEN',
    'An account with that email already exists',
  );

const isPending = (row: InvitationRow, now = new Date()) =>
  !row.acceptedAt && !row.revokedAt && row.expiresAt > now;

const toInvitation = (row: InvitationRow): ClinicInvitation => ({
  id: row.id,
  email: row.email,
  role: row.role,
  expiresAt: toIsoDateTime(row.expiresAt),
  createdAt: toIsoDateTime(row.createdAt),
});

/**
 * A clinic's team: its administrators invite people by email and remove
 * them. Membership (`clinic_staff`) is what `authorize` checks, so removing
 * a row cuts access on the next request; the person's sessions are revoked
 * too, and log-in refuses a clinic user without a clinic.
 */
@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clinics: ClinicsService,
    private readonly mail: MailService,
  ) {}

  async members(userId: string): Promise<ClinicMember[]> {
    const clinic = await this.clinics.adminOf(userId);
    const staff = await this.prisma.clinicStaff.findMany({
      where: { clinicId: clinic.id },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return staff.map((s) => ({
      userId: s.userId,
      name: s.user.name,
      email: s.user.email,
      role: s.role,
      joinedAt: toIsoDateTime(s.createdAt),
    }));
  }

  async invitations(userId: string): Promise<ClinicInvitation[]> {
    const clinic = await this.clinics.adminOf(userId);
    const rows = await this.prisma.clinicInvitation.findMany({
      where: {
        clinicId: clinic.id,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toInvitation);
  }

  /**
   * Emails a single-use link to the requesting site (its Origin was checked).
   * An email that already has an account is refused: an account is either an
   * owner or a clinic member, never both. Inviting the same email again
   * replaces the previous link. If the email cannot be sent the invitation
   * is withdrawn, so no link exists that nobody received.
   */
  async invite(
    userId: string,
    data: CreateClinicInvitation,
    origin: string,
  ): Promise<ClinicInvitation> {
    const clinic = await this.clinics.adminOf(userId);
    const email = data.email.toLowerCase();
    if (await this.prisma.user.count({ where: { email } })) throw emailTaken();

    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const [, invitation, inviter] = await this.prisma.$transaction([
      this.prisma.clinicInvitation.updateMany({
        where: {
          clinicId: clinic.id,
          email,
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: now },
      }),
      this.prisma.clinicInvitation.create({
        data: {
          clinicId: clinic.id,
          email,
          role: data.role,
          tokenHash: hashInvitationToken(token),
          invitedById: userId,
          expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
        },
      }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { name: true },
      }),
    ]);

    try {
      await this.mail.send({
        to: email,
        ...clinicInvitationEmail({
          clinicName: clinic.name,
          inviterName: inviter.name,
          role: data.role,
          link: invitationLink(origin, token),
          days: CLINIC_INVITATION_DAYS,
        }),
      });
    } catch (error) {
      this.logger.error(error);
      await this.prisma.clinicInvitation.update({
        where: { id: invitation.id },
        data: { revokedAt: new Date() },
      });
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'MAIL_UNAVAILABLE',
        'The invitation email could not be sent',
      );
    }
    return toInvitation(invitation);
  }

  async revokeInvitation(userId: string, invitationId: string): Promise<void> {
    const clinic = await this.clinics.adminOf(userId);
    const { count } = await this.prisma.clinicInvitation.updateMany({
      where: {
        id: invitationId,
        clinicId: clinic.id,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    if (count === 0) throw notFound('Invitation not found');
  }

  /**
   * Removes a member: the membership row goes, so `authorize` stops
   * accepting them, and every session of theirs is revoked under their lock
   * (the same one log-in holds). The last administrator cannot be removed.
   */
  async remove(userId: string, memberId: string): Promise<void> {
    const clinic = await this.clinics.adminOf(userId);
    await this.prisma.$transaction(async (tx) => {
      // Serializes removals in this clinic: two admins removing each other
      // cannot leave it without one.
      await tx.$queryRaw`SELECT id FROM clinics WHERE id = ${clinic.id}::uuid FOR UPDATE`;
      const member = await tx.clinicStaff.findUnique({
        where: { clinicId_userId: { clinicId: clinic.id, userId: memberId } },
      });
      if (!member) throw notFound('Member not found');
      if (member.role === 'admin') {
        const admins = await tx.clinicStaff.count({
          where: { clinicId: clinic.id, role: 'admin' },
        });
        if (admins <= 1)
          throw badRequest('The clinic must keep at least one administrator');
      }
      await lockUser(tx, memberId);
      await tx.clinicStaff.delete({ where: { id: member.id } });
      await tx.refreshSession.updateMany({
        where: { userId: memberId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  /** Lets the invited person see which clinic invites them, before signing up. */
  async preview(token: string): Promise<ClinicInvitationPreview> {
    const row = await this.prisma.clinicInvitation.findUnique({
      where: { tokenHash: hashInvitationToken(token) },
      include: { clinic: true },
    });
    if (!row || !isPending(row)) throw invitationInvalid();
    if (row.clinic.suspendedAt) throw clinicSuspended();
    return {
      clinicName: row.clinic.name,
      email: row.email,
      role: row.role,
      expiresAt: toIsoDateTime(row.expiresAt),
    };
  }

  /**
   * Claims the invitation inside the caller's transaction (the account is
   * created in the same one). Atomic: a link used twice, even concurrently,
   * creates one account.
   */
  async claim(
    tx: Prisma.TransactionClient,
    token: string,
  ): Promise<InvitationRow & { clinic: { suspendedAt: Date | null } }> {
    const now = new Date();
    const tokenHash = hashInvitationToken(token);
    const { count } = await tx.clinicInvitation.updateMany({
      where: {
        tokenHash,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { acceptedAt: now },
    });
    if (count === 0) throw invitationInvalid();
    const row = await tx.clinicInvitation.findUniqueOrThrow({
      where: { tokenHash },
      include: { clinic: { select: { suspendedAt: true } } },
    });
    if (row.clinic.suspendedAt) throw clinicSuspended();
    return row;
  }
}
