import { createHmac, randomInt } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LINK_CODE_ALPHABET,
  LINK_CODE_LENGTH,
  type LinkCode,
  type LinkCodePreview,
} from '@vetify/types';
import type { Env } from '../config.js';
import { AppException } from '../common/errors.js';
import type { Clinic, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClinicsService } from './clinics.service.js';

/** A code is shown in person, so a short life is enough. */
export const LINK_CODE_TTL_MS = 10 * 60_000;

const invalidCode = () =>
  new AppException(
    HttpStatus.BAD_REQUEST,
    'LINK_CODE_INVALID',
    'The code is invalid, expired or already used',
  );

export const notVerified = () =>
  new AppException(
    HttpStatus.FORBIDDEN,
    'CLINIC_NOT_VERIFIED',
    'The clinic has not been verified yet. An administrator must review it first.',
  );

/** XXXX-XXXX, easier to read aloud. */
const format = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

/**
 * Link codes tie a permission to a clinic the owner has in front of them.
 * Impersonating a clinic remotely would require guessing a fresh code
 * (31^8 ≈ 8.5·10^11 combinations, 10 minutes, rate limited) issued by a
 * verified clinic account.
 *
 * Only an HMAC of the code is stored: a database leak does not reveal live
 * codes, and the lookup is by the HMAC itself (no timing difference).
 */
@Injectable()
export class LinkCodesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clinics: ClinicsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async issue(userId: string): Promise<LinkCode> {
    const clinic = await this.clinics.ofUser(userId);
    if (!clinic.verified) throw notVerified();

    const code = Array.from(
      { length: LINK_CODE_LENGTH },
      () => LINK_CODE_ALPHABET[randomInt(LINK_CODE_ALPHABET.length)],
    ).join('');
    const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS);

    await this.prisma.clinicLinkCode.create({
      data: {
        clinicId: clinic.id,
        codeHash: this.hash(code),
        createdById: userId,
        expiresAt,
      },
    });
    return { code: format(code), expiresAt: expiresAt.toISOString() };
  }

  /** Lets the owner confirm which clinic a code belongs to before granting. */
  async preview(code: string): Promise<LinkCodePreview> {
    const row = await this.prisma.clinicLinkCode.findUnique({
      where: { codeHash: this.hash(code) },
      include: { clinic: true },
    });
    if (!row || row.usedAt || row.expiresAt < new Date()) throw invalidCode();
    if (!row.clinic.verified) throw notVerified();

    const { id, name, address, verified } = row.clinic;
    return {
      clinic: { id, name, address, verified },
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  /**
   * Marks the code as used for a pet and returns its clinic. Atomic: two
   * owners racing with the same code cannot both succeed.
   */
  async consume(
    tx: Prisma.TransactionClient,
    code: string,
    petId: string,
  ): Promise<Clinic> {
    const codeHash = this.hash(code);
    const { count } = await tx.clinicLinkCode.updateMany({
      where: { codeHash, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date(), usedForPetId: petId },
    });
    if (count === 0) throw invalidCode();

    const { clinic } = await tx.clinicLinkCode.findUniqueOrThrow({
      where: { codeHash },
      include: { clinic: true },
    });
    if (!clinic.verified) throw notVerified();
    return clinic;
  }

  private hash(code: string): string {
    return createHmac(
      'sha256',
      this.config.get('LINK_CODE_SECRET', { infer: true }),
    )
      .update(code)
      .digest('hex');
  }
}
