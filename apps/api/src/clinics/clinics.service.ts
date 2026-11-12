import { HttpStatus, Injectable } from '@nestjs/common';
import type { ClinicRole, MyClinic } from '@vetify/types';
import { AppException, forbidden } from '../common/errors.js';
import type { Clinic as ClinicRow } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toClinic } from './clinic.mapper.js';

export const notClinicMember = () =>
  new AppException(
    HttpStatus.FORBIDDEN,
    'NOT_CLINIC_MEMBER',
    'Your user is not on the team of any clinic',
  );

export interface Membership {
  clinic: ClinicRow;
  role: ClinicRole;
}

/** Clinics and their staff. */
@Injectable()
export class ClinicsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The clinic a `clinic` user works at and their role there. Read on every
   * call: removing someone from the team takes effect on their next request.
   */
  async membership(userId: string): Promise<Membership> {
    const staff = await this.prisma.clinicStaff.findFirst({
      where: { userId },
      include: { clinic: true },
    });
    if (!staff) throw notClinicMember();
    return { clinic: staff.clinic, role: staff.role };
  }

  async ofUser(userId: string): Promise<ClinicRow> {
    return (await this.membership(userId)).clinic;
  }

  /** Team management belongs to the clinic's administrators. */
  async adminOf(userId: string): Promise<ClinicRow> {
    const { clinic, role } = await this.membership(userId);
    if (role !== 'admin')
      throw forbidden("Only the clinic's administrators manage the team");
    return clinic;
  }

  async mine(userId: string): Promise<MyClinic> {
    const { clinic, role } = await this.membership(userId);
    return { ...toClinic(clinic), role };
  }
}
