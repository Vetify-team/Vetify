import { Injectable } from '@nestjs/common';
import type {
  AdminClinicsQuery,
  Clinic,
  SuspendClinic,
  TokenPayload,
} from '@vetify/types';
import { badRequest, notFound } from '../common/errors.js';
import { lockUser } from '../auth/sessions.js';
import { MAX_LIST } from '../common/limits.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toClinic } from '../clinics/clinic.mapper.js';

/**
 * Clinic verification and emergency suspension. Admins never get access to
 * pets or records.
 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async clinics(query: AdminClinicsQuery): Promise<Clinic[]> {
    const clinics = await this.prisma.clinic.findMany({
      where:
        query.verified === undefined
          ? {}
          : { verified: query.verified === 'true' },
      orderBy: { createdAt: 'desc' },
      take: MAX_LIST,
    });
    return clinics.map(toClinic);
  }

  /**
   * Un-verifying stops new link codes; existing permissions stay until the
   * owners revoke them. To cut existing access at once, suspend the clinic.
   */
  async setVerified(clinicId: string, verified: boolean): Promise<Clinic> {
    const { count } = await this.prisma.clinic.updateMany({
      where: { id: clinicId },
      data: { verified, verifiedAt: verified ? new Date() : null },
    });
    if (count === 0) throw notFound('Clinic not found');
    return toClinic(
      await this.prisma.clinic.findUniqueOrThrow({ where: { id: clinicId } }),
    );
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
