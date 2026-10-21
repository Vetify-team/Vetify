import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  AccessLogPage,
  AccessLogQuery,
  GrantPermission,
  Permission,
  PermissionWithClinic,
  TokenPayload,
} from '@vetify/types';
import { toIsoDateTime } from '../common/dates.js';
import { AppException, forbidden, notFound } from '../common/errors.js';
import type {
  Pet as PetRow,
  Permission as PermissionRow,
  Prisma,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toClinic } from '../clinics/clinic.mapper.js';
import {
  LinkCodesService,
  notVerified,
} from '../clinics/link-codes.service.js';

/**
 * What the caller wants to do with a pet's record:
 * - `read`: profile, record, schedule (owner, or clinic with a full permission).
 * - `medical_act`: consultations, vaccinations, exams… (clinic with permission only).
 * - `day_to_day`: weight and feeding (owner only).
 * - `administer`: edit the pet, manage permissions, read the access log (owner only).
 */
export type Operation = 'read' | 'medical_act' | 'day_to_day' | 'administer';

export interface Access {
  pet: PetRow;
  /** Clinic on whose behalf the user acts; null for the owner. */
  clinicId: string | null;
}

const noPermission = () =>
  new AppException(
    HttpStatus.FORBIDDEN,
    'FORBIDDEN',
    'Your clinic has no active permission on this pet',
  );

export const toPermission = (permission: PermissionRow): Permission => ({
  id: permission.id,
  petId: permission.petId,
  clinicId: permission.clinicId,
  scope: permission.scope,
  status: permission.status,
  createdAt: toIsoDateTime(permission.createdAt),
});

/** Cursor of the access log: occurredAt + id, so ties keep a stable order. */
const encodeCursor = (occurredAt: Date, id: string) =>
  Buffer.from(`${occurredAt.toISOString()}|${id}`).toString('base64url');

const decodeCursor = (
  cursor: string,
): { occurredAt: Date; id: string } | null => {
  const [date, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  const occurredAt = new Date(date ?? '');
  return id && !Number.isNaN(occurredAt.getTime()) ? { occurredAt, id } : null;
};

/**
 * Owner → clinic consent and the authorization derived from it. `authorize`
 * is the only door to a pet's record: every service that touches pet data
 * goes through it before reading or writing.
 */
@Injectable()
export class PermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly linkCodes: LinkCodesService,
  ) {}

  async authorize(
    user: TokenPayload,
    petId: string,
    operation: Operation,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<Access> {
    if (user.role === 'owner') {
      const pet = await db.pet.findUnique({ where: { id: petId } });
      // Someone else's pet answers 404 so its existence is not revealed.
      if (!pet || pet.ownerId !== user.sub) throw notFound('Pet not found');
      if (operation === 'medical_act')
        throw forbidden('Medical acts are recorded by the veterinary clinic');
      return { pet, clinicId: null };
    }

    if (user.role !== 'clinic') throw forbidden();
    if (operation === 'day_to_day' || operation === 'administer') {
      throw forbidden("This action belongs to the pet's owner");
    }

    const permission = await db.permission.findFirst({
      where: {
        petId,
        status: 'active',
        scope: 'full',
        clinic: { staff: { some: { userId: user.sub } } },
      },
      include: { pet: true },
    });
    if (!permission) throw noPermission();
    return { pet: permission.pet, clinicId: permission.clinicId };
  }

  /**
   * Pets the user may see in a listing: their own if owner; if clinic, the
   * patients with an active full permission. The same rule as `authorize`,
   * expressed as a Prisma filter.
   */
  visiblePets(user: TokenPayload): Prisma.PetWhereInput {
    if (user.role === 'owner') return { ownerId: user.sub };
    if (user.role === 'clinic') {
      return {
        permissions: {
          some: {
            status: 'active',
            scope: 'full',
            clinic: { staff: { some: { userId: user.sub } } },
          },
        },
      };
    }
    // Admins verify clinics; they never see pets.
    return { id: { in: [] } };
  }

  async list(
    user: TokenPayload,
    petId: string,
  ): Promise<PermissionWithClinic[]> {
    await this.authorize(user, petId, 'administer');
    const permissions = await this.prisma.permission.findMany({
      where: { petId },
      include: { clinic: true },
      orderBy: { createdAt: 'desc' },
    });
    return permissions.map((p) => ({
      ...toPermission(p),
      clinic: toClinic(p.clinic),
    }));
  }

  /**
   * Grants access with the clinic's link code. The code is consumed in the
   * same transaction, so it cannot be reused.
   */
  async grant(
    user: TokenPayload,
    petId: string,
    data: GrantPermission,
  ): Promise<PermissionWithClinic> {
    await this.authorize(user, petId, 'administer');

    return this.prisma.$transaction(async (tx) => {
      const clinic = await this.linkCodes.consume(tx, data.code, petId);
      const permission = await tx.permission.upsert({
        where: { petId_clinicId: { petId, clinicId: clinic.id } },
        create: { petId, clinicId: clinic.id, scope: data.scope },
        update: { scope: data.scope, status: 'active' },
      });
      return { ...toPermission(permission), clinic: toClinic(clinic) };
    });
  }

  /** Revoking cuts access on the next request: permissions are not cached. */
  async revoke(
    user: TokenPayload,
    petId: string,
    permissionId: string,
  ): Promise<Permission> {
    return this.setStatus(user, petId, permissionId, 'revoked');
  }

  /**
   * Gives a previously linked clinic its access back. No new code is needed:
   * the clinic was already confirmed in person. It must still be verified.
   */
  async restore(
    user: TokenPayload,
    petId: string,
    permissionId: string,
  ): Promise<Permission> {
    await this.authorize(user, petId, 'administer');
    const permission = await this.prisma.permission.findFirst({
      where: { id: permissionId, petId },
      include: { clinic: true },
    });
    if (!permission) throw notFound('Permission not found');
    if (!permission.clinic.verified) throw notVerified();
    return this.setStatus(user, petId, permissionId, 'active');
  }

  async accessLog(
    user: TokenPayload,
    petId: string,
    query: AccessLogQuery,
  ): Promise<AccessLogPage> {
    const { pet } = await this.authorize(user, petId, 'administer');
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;

    const entries = await this.prisma.accessLog.findMany({
      where: {
        petId,
        ...(query.actor === 'others' ? { NOT: { userId: pet.ownerId } } : {}),
        ...(cursor
          ? {
              OR: [
                { occurredAt: { lt: cursor.occurredAt } },
                { occurredAt: cursor.occurredAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      include: { user: { select: { name: true, role: true } } },
    });

    const page = entries.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: page.map((entry) => ({
        id: entry.id,
        petId: entry.petId,
        userId: entry.userId,
        action: entry.action,
        occurredAt: toIsoDateTime(entry.occurredAt),
        actor: entry.user
          ? { name: entry.user.name, role: entry.user.role }
          : null,
      })),
      nextCursor:
        entries.length > query.limit && last
          ? encodeCursor(last.occurredAt, last.id)
          : null,
    };
  }

  private async setStatus(
    user: TokenPayload,
    petId: string,
    permissionId: string,
    status: 'active' | 'revoked',
  ): Promise<Permission> {
    await this.authorize(user, petId, 'administer');
    const { count } = await this.prisma.permission.updateMany({
      where: { id: permissionId, petId },
      data: { status },
    });
    if (count === 0) throw notFound('Permission not found');
    return toPermission(
      await this.prisma.permission.findUniqueOrThrow({
        where: { id: permissionId },
      }),
    );
  }
}
