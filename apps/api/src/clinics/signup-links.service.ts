import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  CLINIC_SIGNUP_DAYS,
  clinicPlanIdSchema,
  type ClinicSignupLink,
  type ClinicSignupPreview,
  type CreateClinicSignupLink,
  type IssuedClinicSignupLink,
} from '@vetify/types';
import { toIsoDateTime } from '../common/dates.js';
import { AppException } from '../common/errors.js';
import { hashLinkToken, newLinkToken } from '../common/link-tokens.js';
import type {
  ClinicSignupLink as LinkRow,
  Prisma,
} from '../generated/prisma/client.js';
import { MailService } from '../mail/mail.service.js';
import { clinicSignupEmail } from '../mail/templates.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const SIGNUP_LINK_TTL_MS = CLINIC_SIGNUP_DAYS * 86_400_000;

/** The wizard reads the token from the #fragment. */
export const signupLink = (origin: string, token: string): string =>
  `${origin}/registro#clinica=${token}`;

export const signupLinkInvalid = () =>
  new AppException(
    HttpStatus.BAD_REQUEST,
    'SIGNUP_LINK_INVALID',
    'The sign-up link is invalid, expired, revoked or already used',
  );

const emailTaken = () =>
  new AppException(
    HttpStatus.CONFLICT,
    'EMAIL_TAKEN',
    'An account with that email already exists',
  );

const toLink = (row: LinkRow): ClinicSignupLink => ({
  id: row.id,
  email: row.email,
  clinicName: row.clinicName,
  plan: clinicPlanIdSchema.parse(row.plan),
  paymentReference: row.paymentReference,
  expiresAt: toIsoDateTime(row.expiresAt),
  createdAt: toIsoDateTime(row.createdAt),
});

const pendingWhere = (now = new Date()) => ({
  usedAt: null,
  revokedAt: null,
  expiresAt: { gt: now },
});

/**
 * Clinics join Vetify through a single-use link an administrator issues
 * once the plan is agreed and paid (ONVO Checkout needs an account, so the
 * first payment is confirmed outside the app). The link fixes the email and
 * the plan; registering creates the clinic with that person as its admin.
 */
@Injectable()
export class SignupLinksService {
  private readonly logger = new Logger(SignupLinksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async pending(): Promise<ClinicSignupLink[]> {
    const rows = await this.prisma.clinicSignupLink.findMany({
      where: pendingWhere(),
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toLink);
  }

  /**
   * Stores the hash, emails the link and returns it once so the admin can
   * also hand it over another way. An email that already has an account is
   * refused. A failed email does not undo the link: the admin still has it.
   */
  async issue(
    adminId: string,
    data: CreateClinicSignupLink,
    origin: string,
  ): Promise<IssuedClinicSignupLink> {
    const email = data.email.toLowerCase();
    if (await this.prisma.user.count({ where: { email } })) throw emailTaken();

    const token = newLinkToken();
    const row = await this.prisma.clinicSignupLink.create({
      data: {
        email,
        clinicName: data.clinicName,
        plan: data.plan,
        paymentReference: data.paymentReference ?? null,
        tokenHash: hashLinkToken(token),
        createdById: adminId,
        expiresAt: new Date(Date.now() + SIGNUP_LINK_TTL_MS),
      },
    });
    const url = signupLink(origin, token);
    void this.mail
      .send({
        to: email,
        ...clinicSignupEmail({
          clinicName: data.clinicName,
          link: url,
          days: CLINIC_SIGNUP_DAYS,
        }),
      })
      .catch((error: unknown) => this.logger.error(error));
    return { ...toLink(row), url };
  }

  async revoke(linkId: string): Promise<void> {
    const { count } = await this.prisma.clinicSignupLink.updateMany({
      where: { id: linkId, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'NOT_FOUND',
        'Sign-up link not found',
      );
  }

  async preview(token: string): Promise<ClinicSignupPreview> {
    const row = await this.prisma.clinicSignupLink.findFirst({
      where: { tokenHash: hashLinkToken(token), ...pendingWhere() },
    });
    if (!row) throw signupLinkInvalid();
    const { email, clinicName, plan, expiresAt } = toLink(row);
    return { email, clinicName, plan, expiresAt };
  }

  /**
   * Claims the link inside the caller's transaction (the clinic is created
   * in the same one). Atomic: a link used twice, even at once, registers one
   * clinic.
   */
  async claim(tx: Prisma.TransactionClient, token: string): Promise<LinkRow> {
    const tokenHash = hashLinkToken(token);
    const { count } = await tx.clinicSignupLink.updateMany({
      where: { tokenHash, ...pendingWhere() },
      data: { usedAt: new Date() },
    });
    if (count === 0) throw signupLinkInvalid();
    return tx.clinicSignupLink.findUniqueOrThrow({ where: { tokenHash } });
  }
}
