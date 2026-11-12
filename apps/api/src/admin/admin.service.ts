import { Injectable, Logger } from '@nestjs/common';
import type {
  AdminClinic,
  AdminClinicsQuery,
  Clinic,
  SuspendClinic,
  TokenPayload,
} from '@vetify/types';
import { badRequest, notFound } from '../common/errors.js';
import { lockUser } from '../auth/sessions.js';
import { toIsoDateTime } from '../common/dates.js';
import { MAX_LIST } from '../common/limits.js';
import type { Clinic as ClinicRow } from '../generated/prisma/client.js';
import { MailService } from '../mail/mail.service.js';
import { clinicVerifiedEmail } from '../mail/templates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toClinic } from '../clinics/clinic.mapper.js';

const WITH_VERIFIER = { verifiedBy: { select: { name: true } } } as const;

const toAdminClinic = (
  clinic: ClinicRow & { verifiedBy: { name: string } | null },
): AdminClinic => ({
  ...toClinic(clinic),
  verifiedAt: clinic.verifiedAt ? toIsoDateTime(clinic.verifiedAt) : null,
  verifiedBy: clinic.verifiedBy,
});

/**
 * Clinic verification and emergency suspension. Admins never get access to
 * pets or records.
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async clinics(query: AdminClinicsQuery): Promise<AdminClinic[]> {
    const clinics = await this.prisma.clinic.findMany({
      where:
        query.verified === undefined
          ? {}
          : { verified: query.verified === 'true' },
      include: WITH_VERIFIER,
      orderBy: { createdAt: 'desc' },
      take: MAX_LIST,
    });
    return clinics.map(toAdminClinic);
  }

  /**
   * Records who verified the clinic and emails its administrators. Only the
   * request that changes the state does either: verifying a verified clinic
   * keeps the original verifier and sends nothing. `origin` builds the link
   * in the email; without it the email has no button.
   */
  async verify(
    admin: TokenPayload,
    clinicId: string,
    origin: string | null,
  ): Promise<AdminClinic> {
    const { count } = await this.prisma.clinic.updateMany({
      where: { id: clinicId, verified: false },
      data: { verified: true, verifiedAt: new Date(), verifiedById: admin.sub },
    });
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      include: {
        ...WITH_VERIFIER,
        staff: {
          where: { role: 'admin' },
          select: { user: { select: { email: true, name: true } } },
        },
      },
    });
    if (!clinic) throw notFound('Clinic not found');
    if (count === 1) this.sendVerified(clinic, origin);
    return toAdminClinic(clinic);
  }

  /**
   * Un-verifying stops new link codes; existing permissions stay until the
   * owners revoke them. To cut existing access at once, suspend the clinic.
   */
  async unverify(clinicId: string): Promise<AdminClinic> {
    const { count } = await this.prisma.clinic.updateMany({
      where: { id: clinicId },
      data: { verified: false, verifiedAt: null, verifiedById: null },
    });
    if (count === 0) throw notFound('Clinic not found');
    return toAdminClinic(
      await this.prisma.clinic.findUniqueOrThrow({
        where: { id: clinicId },
        include: WITH_VERIFIER,
      }),
    );
  }

  /**
   * Fire and forget after the update: a slow or failing Resend never fails
   * the verification, which is already saved. Not retried; the clinic also
   * sees the change in its portal.
   */
  private sendVerified(
    clinic: ClinicRow & {
      staff: { user: { email: string; name: string } }[];
    },
    origin: string | null,
  ): void {
    const link = origin ? `${origin}/codigo` : null;
    for (const { user } of clinic.staff) {
      void this.mail
        .send({
          to: user.email,
          ...clinicVerifiedEmail({
            name: user.name,
            clinicName: clinic.name,
            link,
          }),
        })
        .catch((error: unknown) => this.logger.error(error));
    }
  }

  /**
   * Cuts the clinic off at once: its permissions stop counting in
   * `authorize`, every session of its staff is revoked (access tokens die on
   * their next request) and nobody on its staff can open a new one until it
   * is reinstated. Permissions are kept, so reinstating restores them.
   */
  async suspend(
    admin: TokenPayload,
    clinicId: string,
    data: SuspendClinic,
  ): Promise<Clinic> {
    return this.prisma.$transaction(async (tx) => {
      const clinic = await tx.clinic.findUnique({
        where: { id: clinicId },
        include: {
          staff: { select: { userId: true }, orderBy: { userId: 'asc' } },
        },
      });
      if (!clinic) throw notFound('Clinic not found');

      const now = new Date();
      const { count } = await tx.clinic.updateMany({
        where: { id: clinicId, suspendedAt: null },
        data: { suspendedAt: now },
      });
      if (count === 0) throw badRequest('The clinic is already suspended');

      await tx.clinicSuspension.create({
        data: {
          clinicId,
          reason: data.reason,
          suspendedById: admin.sub,
          suspendedAt: now,
        },
      });
      // Same lock as session issuance, in a stable order: a log-in that
      // already passed the suspension check commits first and is revoked here.
      const userIds = clinic.staff.map((s) => s.userId);
      for (const userId of userIds) await lockUser(tx, userId);
      await tx.refreshSession.updateMany({
        where: { userId: { in: userIds }, revokedAt: null },
        data: { revokedAt: now },
      });
      return toClinic(
        await tx.clinic.findUniqueOrThrow({ where: { id: clinicId } }),
      );
    });
  }

  /** Lifts the suspension and closes its audit row. */
  async reinstate(admin: TokenPayload, clinicId: string): Promise<Clinic> {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const { count } = await tx.clinic.updateMany({
        where: { id: clinicId, suspendedAt: { not: null } },
        data: { suspendedAt: null },
      });
      if (count === 0) {
        const exists = await tx.clinic.count({ where: { id: clinicId } });
        if (!exists) throw notFound('Clinic not found');
        throw badRequest('The clinic is not suspended');
      }
      await tx.clinicSuspension.updateMany({
        where: { clinicId, liftedAt: null },
        data: { liftedAt: now, liftedById: admin.sub },
      });
      return toClinic(
        await tx.clinic.findUniqueOrThrow({ where: { id: clinicId } }),
      );
    });
  }
}
