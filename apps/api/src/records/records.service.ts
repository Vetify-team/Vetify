import { Injectable } from '@nestjs/common';
import type {
  Alert,
  Consultation,
  CreateConsultation,
  CreateDeworming,
  CreateExam,
  CreateFeedingEntry,
  CreateTreatment,
  CreateVaccination,
  CreateWeightEntry,
  Deworming,
  Exam,
  FeedingEntry,
  MedicalRecord,
  RecordQuery,
  RecordSection,
  TokenPayload,
  Treatment,
  Vaccination,
  VaccinationStatus,
  WeightEntry,
} from '@vetify/types';
import { AccessLogService } from '../access-log/access-log.service.js';
import {
  fromIsoDate,
  fromIsoDateOrUndefined,
  todayInCostaRica,
} from '../common/dates.js';
import { badRequest } from '../common/errors.js';
import { Prisma, type Pet as PetRow } from '../generated/prisma/client.js';
import { PermissionsService } from '../permissions/permissions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  toConsultation,
  toDeworming,
  toExam,
  toFeedingEntry,
  toTreatment,
  toVaccination,
  toWeightEntry,
} from './record.mappers.js';
import {
  alertsForPet,
  computeExpiry,
  computeVaccinationStatus,
  normalizeName,
  sortAlerts,
  type AppliedVaccine,
  type AppliedDeworming,
} from './vaccination.js';

/** Country of the vaccination schedule. Pets have no country yet; the pilot is in Costa Rica. */
const SCHEDULE_COUNTRY = 'CR';
/** Upper bound for list endpoints that aggregate several pets. */
const MAX_PETS = 200;

/**
 * Consultations, vaccinations, dewormings, treatments, exams, weight and
 * feeding.
 *
 * Product rule: medical acts are written by a clinic with an active
 * permission; the day to day, by the owner; both read. Every method starts
 * with PermissionsService.authorize, and the access log is written by the
 * global interceptor.
 */
@Injectable()
export class RecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly accessLog: AccessLogService,
  ) {}

  async get(
    user: TokenPayload,
    petId: string,
    query: RecordQuery = { limit: 50 },
  ): Promise<MedicalRecord> {
    await this.permissions.authorize(user, petId, 'read');

    const pet = await this.prisma.pet.findUniqueOrThrow({
      where: { id: petId },
      include: {
        consultations: this.historyArgs(query, 'consultations', 'date', petId),
        vaccinations: this.historyArgs(
          query,
          'vaccinations',
          'appliedOn',
          petId,
        ),
        dewormings: this.historyArgs(query, 'dewormings', 'appliedOn', petId),
        treatments: this.historyArgs(query, 'treatments', 'startsOn', petId),
        exams: this.historyArgs(query, 'exams', 'performedOn', petId),
        weightEntries: this.historyArgs(
          query,
          'weightEntries',
          'recordedOn',
          petId,
        ),
        feedingEntries: this.historyArgs(
          query,
          'feedingEntries',
          'recordedOn',
          petId,
        ),
      },
    });

    const nextCursors: MedicalRecord['nextCursors'] = {};
    const page = <T extends { id: string }>(
      rows: T[] | undefined,
      section: RecordSection,
    ): T[] => {
      const entries = rows ?? [];
      if (entries.length > query.limit)
        nextCursors[section] = entries[query.limit - 1]!.id;
      return entries.slice(0, query.limit);
    };
    const consultations = page(pet.consultations, 'consultations');
    const vaccinations = page(pet.vaccinations, 'vaccinations');
    const dewormings = page(pet.dewormings, 'dewormings');
    const treatments = page(pet.treatments, 'treatments');
    const exams = page(pet.exams, 'exams');
    const weightEntries = page(pet.weightEntries, 'weightEntries');
    const feedingEntries = page(pet.feedingEntries, 'feedingEntries');

    // Names of the clinics and veterinarians that appear in the history.
    const clinicIds = [
      ...new Set(
        [...consultations, ...vaccinations]
          .map((r) => r.clinicId)
          .filter((id): id is string => !!id),
      ),
    ];
    const vetIds = [
      ...new Set(
        consultations
          .map((c) => c.veterinarianId)
          .filter((id): id is string => !!id),
      ),
    ];
    const [clinics, veterinarians] = await Promise.all([
      this.prisma.clinic.findMany({
        where: { id: { in: clinicIds } },
        select: { id: true, name: true },
      }),
      this.prisma.user.findMany({
        where: { id: { in: vetIds } },
        select: { id: true, name: true },
      }),
    ]);

    return {
      nextCursors,
      clinics,
      veterinarians,
      consultations: consultations.map(toConsultation),
      vaccinations: vaccinations.map(toVaccination),
      dewormings: dewormings.map(toDeworming),
      treatments: treatments.map(toTreatment),
      exams: exams.map(toExam),
      weightEntries: weightEntries.map(toWeightEntry),
      feedingEntries: feedingEntries.map(toFeedingEntry),
    };
  }

  private historyArgs(
    query: RecordQuery,
    section: RecordSection,
    date: string,
    petId: string,
  ) {
    if (query.section && query.section !== section) return false as const;
    return {
      orderBy: [{ [date]: 'desc' as const }, { id: 'desc' as const }],
      take: query.limit + 1,
      // Scope the cursor lookup as well as the returned rows. A foreign
      // cursor must not become an oracle for another pet's record dates.
      ...(query.cursor ? { cursor: { id: query.cursor, petId }, skip: 1 } : {}),
    };
  }

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
   * each patient checked is logged (deduplicated): seeing its schedule is
   * accessing its record.
   */
  async alerts(user: TokenPayload): Promise<Alert[]> {
    const pets = await this.prisma.pet.findMany({
      where: this.permissions.visiblePets(user),
      orderBy: { name: 'asc' },
      take: MAX_PETS,
    });
    const statuses = await this.computeStatuses(pets);

    if (user.role === 'clinic') {
      await this.accessLog.record({
        petIds: pets.map((p) => p.id),
        userId: user.sub,
        action: 'view_alerts',
        dedupe: true,
      });
    }

    return sortAlerts(
      pets.flatMap((pet) => alertsForPet(pet, statuses.get(pet.id)!)),
    );
  }

  /** Vaccination and deworming status of several pets in a few queries. */
  private async computeStatuses(
    pets: PetRow[],
  ): Promise<Map<string, VaccinationStatus>> {
    if (!pets.length) return new Map();
    const ids = pets.map((p) => p.id);
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
        WHERE p.id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
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
          WHERE p.id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
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
          WHERE p.id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
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

  // ---------- Medical acts (clinic with an active permission) ----------

  async recordConsultation(
    user: TokenPayload,
    petId: string,
    data: CreateConsultation,
  ): Promise<Consultation> {
    // clinicId and veterinarianId come from the permission and the token,
    // never from the request: a clinic cannot sign as another.
    const { clinicId } = await this.permissions.authorize(
      user,
      petId,
      'medical_act',
    );
    const consultation = await this.prisma.consultation.create({
      data: {
        petId,
        clinicId,
        veterinarianId: user.sub,
        date: data.date ? new Date(data.date) : undefined,
        reason: data.reason ?? null,
        diagnosis: data.diagnosis ?? null,
        notes: data.notes ?? null,
      },
    });
    return toConsultation(consultation);
  }

  /**
   * Without an explicit expiry, the schedule's validity is used. With a known
   * expiry, a reminder for the booster is scheduled.
   */
  async recordVaccination(
    user: TokenPayload,
    petId: string,
    data: CreateVaccination,
  ): Promise<Vaccination> {
    const { pet, clinicId } = await this.permissions.authorize(
      user,
      petId,
      'medical_act',
    );

    const rules = await this.prisma.vaccinationRule.findMany({
      where: { country: SCHEDULE_COUNTRY, species: pet.species },
    });
    const rule = rules.find(
      (r) => normalizeName(r.vaccine) === normalizeName(data.vaccine),
    );

    const appliedOn = fromIsoDate(data.appliedOn);
    const expiresOn = computeExpiry(
      {
        vaccine: data.vaccine,
        appliedOn,
        expiresOn: fromIsoDateOrUndefined(data.expiresOn) ?? null,
      },
      rule,
    );
    if (expiresOn && expiresOn < appliedOn)
      throw badRequest('Expiry cannot be before the application date');

    const vaccination = await this.prisma.$transaction(async (tx) => {
      const created = await tx.vaccination.create({
        data: {
          petId,
          clinicId,
          vaccine: rule?.vaccine ?? data.vaccine,
          batch: data.batch ?? null,
          appliedOn,
          expiresOn,
        },
      });
      if (expiresOn)
        await tx.reminder.create({
          data: { petId, kind: 'vaccination', dueOn: expiresOn },
        });
      return created;
    });
    return toVaccination(vaccination);
  }

  async recordDeworming(
    user: TokenPayload,
    petId: string,
    data: CreateDeworming,
  ): Promise<Deworming> {
    await this.permissions.authorize(user, petId, 'medical_act');
    const appliedOn = fromIsoDate(data.appliedOn);
    const nextDueOn = fromIsoDateOrUndefined(data.nextDueOn) ?? null;
    if (nextDueOn && nextDueOn < appliedOn)
      throw badRequest('The next dose cannot be before the application date');

    const deworming = await this.prisma.$transaction(async (tx) => {
      const created = await tx.deworming.create({
        data: {
          petId,
          product: data.product ?? null,
          kind: data.kind ?? null,
          appliedOn,
          nextDueOn,
        },
      });
      if (nextDueOn)
        await tx.reminder.create({
          data: { petId, kind: 'deworming', dueOn: nextDueOn },
        });
      return created;
    });
    return toDeworming(deworming);
  }

  async recordTreatment(
    user: TokenPayload,
    petId: string,
    data: CreateTreatment,
  ): Promise<Treatment> {
    await this.permissions.authorize(user, petId, 'medical_act');

    if (data.consultationId) {
      const consultation = await this.prisma.consultation.findFirst({
        where: { id: data.consultationId, petId },
      });
      if (!consultation)
        throw badRequest('The consultation does not belong to this pet');
    }
    const startsOn = fromIsoDateOrUndefined(data.startsOn) ?? null;
    const endsOn = fromIsoDateOrUndefined(data.endsOn) ?? null;
    if (startsOn && endsOn && endsOn < startsOn)
      throw badRequest('The end cannot be before the start');

    const treatment = await this.prisma.treatment.create({
      data: {
        petId,
        consultationId: data.consultationId ?? null,
        description: data.description,
        startsOn,
        endsOn,
      },
    });
    return toTreatment(treatment);
  }

  async recordExam(
    user: TokenPayload,
    petId: string,
    data: CreateExam,
  ): Promise<Exam> {
    await this.permissions.authorize(user, petId, 'medical_act');
    const exam = await this.prisma.exam.create({
      data: {
        petId,
        kind: data.kind ?? null,
        performedOn: fromIsoDate(data.performedOn),
        fileUrl: data.fileUrl ?? null,
        result: data.result ?? null,
      },
    });
    return toExam(exam);
  }

  // ---------- Day to day (owner) ----------

  async recordWeight(
    user: TokenPayload,
    petId: string,
    data: CreateWeightEntry,
  ): Promise<WeightEntry> {
    await this.permissions.authorize(user, petId, 'day_to_day');
    const entry = await this.prisma.weightEntry.create({
      data: {
        petId,
        weightKg: data.weightKg,
        recordedOn:
          fromIsoDateOrUndefined(data.recordedOn) ?? todayInCostaRica(),
      },
    });
    return toWeightEntry(entry);
  }

  async recordFeeding(
    user: TokenPayload,
    petId: string,
    data: CreateFeedingEntry,
  ): Promise<FeedingEntry> {
    await this.permissions.authorize(user, petId, 'day_to_day');
    const entry = await this.prisma.feedingEntry.create({
      data: {
        petId,
        notes: data.notes ?? null,
        recordedOn:
          fromIsoDateOrUndefined(data.recordedOn) ?? todayInCostaRica(),
      },
    });
    return toFeedingEntry(entry);
  }
}
