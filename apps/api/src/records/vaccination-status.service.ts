import { Injectable } from '@nestjs/common';
import type { Alert, TokenPayload, VaccinationStatus } from '@vetify/types';
import { todayInCostaRica } from '../common/dates.js';
import { badRequest } from '../common/errors.js';
import { Prisma, type Pet as PetRow } from '../generated/prisma/client.js';
import { PermissionsService } from '../permissions/permissions.service.js';
import { PetsService } from '../pets/pets.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  alertsForPet,
  computeVaccinationStatus,
  sortAlerts,
  type AppliedDeworming,
  type AppliedVaccine,
} from './vaccination.js';

/** Country of the vaccination schedule. Pets have no country yet; the pilot is in Costa Rica. */
export const SCHEDULE_COUNTRY = 'CR';

/**
 * Vaccination/deworming status and the alerts derived from it. Reads only the
 * latest dose of each vaccine and deworming kind, independent of the history
 * pages loaded by the client.
 */
@Injectable()
export class VaccinationStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly pets: PetsService,
  ) {}

  async vaccinationStatus(
    user: TokenPayload,
    petId: string,
  ): Promise<VaccinationStatus> {
    const { pet } = await this.permissions.authorize(user, petId, 'read');
    const statuses = await this.computeStatuses([pet]);
    return statuses.get(pet.id)!;
  }

  /**
   * Overdue and upcoming doses of every pet visible to the user. For a clinic,
   * each patient checked is logged: seeing its schedule is accessing its record.
   */
  async alerts(user: TokenPayload): Promise<Alert[]> {
    const pets = await this.pets.listVisible(user, 'view_alerts');
    const statuses = await this.computeStatuses(pets);
    return sortAlerts(
      pets.flatMap((pet) => alertsForPet(pet, statuses.get(pet.id)!)),
    );
  }

  /** Vaccination and deworming status of several pets in a few queries. */
  private async computeStatuses(
    pets: PetRow[],
  ): Promise<Map<string, VaccinationStatus>> {
    if (!pets.length) return new Map();
    const petIdList = Prisma.join(pets.map((p) => Prisma.sql`${p.id}::uuid`));
    const species = [...new Set(pets.map((p) => p.species))];
    const [rules, vaccinations, dewormings] = await Promise.all([
      this.prisma.vaccinationRule.findMany({
        where: { country: SCHEDULE_COUNTRY, species: { in: species } },
        orderBy: { minAgeMonths: 'asc' },
      }),
      // Fetch only the latest dose for each scheduled vaccine, using the
      // expression index from the security migration. Historical names are
      // matched case/accent-insensitively, as in normalizeName().
      this.prisma.$queryRaw<(AppliedVaccine & { petId: string })[]>(Prisma.sql`
        SELECT latest.* FROM pets p
        JOIN vaccination_rules r ON r.species = p.species AND r.country = ${SCHEDULE_COUNTRY}
        CROSS JOIN LATERAL (
          SELECT v.pet_id AS "petId", v.vaccine, v.applied_on AS "appliedOn", v.expires_on AS "expiresOn"
          FROM vaccinations v
          WHERE v.pet_id = p.id AND
            lower(regexp_replace(normalize(btrim(v.vaccine), NFD), U&'[\\0300-\\036f]', '', 'g')) =
            lower(regexp_replace(normalize(btrim(r.vaccine), NFD), U&'[\\0300-\\036f]', '', 'g'))
          ORDER BY v.applied_on DESC, v.id DESC LIMIT 1
        ) latest
        WHERE p.id IN (${petIdList})
      `),
      this.prisma.$queryRaw<
        (AppliedDeworming & { petId: string })[]
      >(Prisma.sql`
        -- Walk distinct kinds with index seeks instead of scanning every old
        -- dose for DISTINCT ON. Include legacy kinds, but bound each walk.
        WITH RECURSIVE kinds AS (
          SELECT p.id AS pet_id, first_kind.kind, 1 AS depth
          FROM pets p CROSS JOIN LATERAL (
            SELECT d.kind FROM dewormings d
            WHERE d.pet_id = p.id AND d.kind IS NOT NULL
            ORDER BY d.kind LIMIT 1
          ) first_kind
          WHERE p.id IN (${petIdList})
          UNION ALL
          SELECT k.pet_id, next_kind.kind, k.depth + 1
          FROM kinds k CROSS JOIN LATERAL (
            SELECT d.kind FROM dewormings d
            WHERE d.pet_id = k.pet_id AND d.kind > k.kind
            ORDER BY d.kind LIMIT 1
          ) next_kind WHERE k.depth < 101
        )
        SELECT result.* FROM (
          SELECT latest.* FROM kinds k CROSS JOIN LATERAL (
            SELECT d.pet_id AS "petId", d.kind, d.product,
              d.applied_on AS "appliedOn", d.next_due_on AS "nextDueOn"
            FROM dewormings d WHERE d.pet_id = k.pet_id AND d.kind = k.kind
            ORDER BY d.applied_on DESC, d.id DESC LIMIT 1
          ) latest
          UNION ALL
          SELECT latest.* FROM pets p CROSS JOIN LATERAL (
            SELECT d.pet_id AS "petId", d.kind, d.product,
              d.applied_on AS "appliedOn", d.next_due_on AS "nextDueOn"
            FROM dewormings d WHERE d.pet_id = p.id AND d.kind IS NULL
            ORDER BY d.applied_on DESC, d.id DESC LIMIT 1
          ) latest
          WHERE p.id IN (${petIdList})
        ) result ORDER BY "petId", kind
      `),
    ]);
    // New inputs only allow internal/external. Bound legacy free-text kinds
    // too, and fail explicitly instead of returning incomplete clinical data.
    if (
      pets.some(
        (pet) => dewormings.filter((d) => d.petId === pet.id).length > 100,
      )
    ) {
      throw badRequest(
        'Too many legacy deworming kinds; contact support to consolidate them',
      );
    }
    const today = todayInCostaRica();

    return new Map(
      pets.map((pet) => [
        pet.id,
        computeVaccinationStatus({
          country: SCHEDULE_COUNTRY,
          species: pet.species,
          schedule: rules.filter((r) => r.species === pet.species),
          applied: vaccinations.filter((v) => v.petId === pet.id),
          dewormings: dewormings.filter((d) => d.petId === pet.id),
          birthDate: pet.birthDate,
          today,
        }),
      ]),
    );
  }
}
