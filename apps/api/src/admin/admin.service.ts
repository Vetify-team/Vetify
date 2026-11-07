import { Injectable } from '@nestjs/common';
import type { AdminClinicsQuery, Clinic } from '@vetify/types';
import { notFound } from '../common/errors.js';
import { MAX_LIST } from '../common/limits.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toClinic } from '../clinics/clinic.mapper.js';

/** Clinic verification. Admins never get access to pets or records. */
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
   * owners revoke them.
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
}
