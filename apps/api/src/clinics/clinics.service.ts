import { Injectable } from '@nestjs/common';
import type { Clinic } from '@vetify/types';
import { notFound } from '../common/errors.js';
import type { Clinic as ClinicRow } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toClinic } from './clinic.mapper.js';

/** Clinics and their staff. */
@Injectable()
export class ClinicsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The clinic a `clinic` user works at. */
  async ofUser(userId: string): Promise<ClinicRow> {
    const staff = await this.prisma.clinicStaff.findFirst({
      where: { userId },
      include: { clinic: true },
    });
    if (!staff) throw notFound('Your user is not linked to any clinic');
    return staff.clinic;
  }

  async mine(userId: string): Promise<Clinic> {
    return toClinic(await this.ofUser(userId));
  }
}
