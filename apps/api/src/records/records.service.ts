import { Injectable } from '@nestjs/common';
import type {
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
  WeightEntry,
} from '@vetify/types';
import { DEFAULT_PAGE_SIZE } from '@vetify/types';
import {
  fromIsoDate,
  fromIsoDateOrUndefined,
  todayInCostaRica,
} from '../common/dates.js';
import { badRequest } from '../common/errors.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  PermissionsService,
  type Access,
  type Operation,
} from '../permissions/permissions.service.js';
import { idempotentWrite } from '../common/idempotency.js';
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
import { SCHEDULE_COUNTRY } from './vaccination-status.service.js';
import { computeExpiry, normalizeName } from './vaccination.js';

/**
 * Each record write and the permission it needs. The names prefix the scopes
 * stored with idempotency results; renaming one breaks in-flight retries.
 */
const WRITES = {
  recordConsultation: 'medical_act',
  recordVaccination: 'medical_act',
  recordDeworming: 'medical_act',
  recordTreatment: 'medical_act',
  recordExam: 'medical_act',
  recordWeight: 'day_to_day',
  recordFeeding: 'day_to_day',
} as const satisfies Record<string, Operation>;

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
  ) {}

  async get(
    user: TokenPayload,
    petId: string,
    query: RecordQuery = { limit: DEFAULT_PAGE_SIZE },
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

  /**
   * Authorize the write's operation on the pet and run `fn` as a keyed write
   * scoped to this write and pet. Every record write goes through here.
   */
  private write<T>(
    name: keyof typeof WRITES,
    user: TokenPayload,
    petId: string,
    data: unknown,
    key: string | undefined,
    fn: (tx: Prisma.TransactionClient, access: Access) => Promise<T>,
  ): Promise<T> {
    return idempotentWrite(this.prisma, {
      user,
      scope: `${name}:${petId.toLowerCase()}`,
      key,
      payload: data,
      authorize: (tx) =>
        this.permissions.authorize(user, petId, WRITES[name], tx),
      write: fn,
    });
  }

  // ---------- Medical acts (clinic with an active permission) ----------

  async recordConsultation(
    user: TokenPayload,
    petId: string,
    data: CreateConsultation,
    key?: string,
  ): Promise<Consultation> {
    return this.write(
      'recordConsultation',
      user,
      petId,
      data,
      key,
      async (tx, { clinicId }) => {
        // clinicId and veterinarianId come from the permission and the token,
        // never from the request: a clinic cannot sign as another.

        const consultation = await tx.consultation.create({
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
      },
    );
  }

  /**
   * Without an explicit expiry, the schedule's validity is used. With a known
   * expiry, a reminder for the booster is scheduled.
   */
  async recordVaccination(
    user: TokenPayload,
    petId: string,
    data: CreateVaccination,
    key?: string,
  ): Promise<Vaccination> {
    return this.write(
      'recordVaccination',
      user,
      petId,
      data,
      key,
      async (tx, { pet, clinicId }) => {
        const rules = await tx.vaccinationRule.findMany({
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
          throw badRequest(
            'Expiry cannot be before the application date',
            'EXPIRY_BEFORE_APPLIED',
          );

        const vaccination = await tx.vaccination.create({
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
        return toVaccination(vaccination);
      },
    );
  }

  async recordDeworming(
    user: TokenPayload,
    petId: string,
    data: CreateDeworming,
    key?: string,
  ): Promise<Deworming> {
    return this.write('recordDeworming', user, petId, data, key, async (tx) => {
      const appliedOn = fromIsoDate(data.appliedOn);
      const nextDueOn = fromIsoDateOrUndefined(data.nextDueOn) ?? null;
      if (nextDueOn && nextDueOn < appliedOn)
        throw badRequest(
          'The next dose cannot be before the application date',
          'NEXT_DOSE_BEFORE_APPLIED',
        );

      const deworming = await tx.deworming.create({
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
      return toDeworming(deworming);
    });
  }

  async recordTreatment(
    user: TokenPayload,
    petId: string,
    data: CreateTreatment,
    key?: string,
  ): Promise<Treatment> {
    return this.write('recordTreatment', user, petId, data, key, async (tx) => {
      if (data.consultationId) {
        const consultation = await tx.consultation.findFirst({
          where: { id: data.consultationId, petId },
        });
        if (!consultation)
          throw badRequest(
            'The consultation does not belong to this pet',
            'CONSULTATION_NOT_IN_PET',
          );
      }
      const startsOn = fromIsoDateOrUndefined(data.startsOn) ?? null;
      const endsOn = fromIsoDateOrUndefined(data.endsOn) ?? null;
      if (startsOn && endsOn && endsOn < startsOn)
        throw badRequest(
          'The end cannot be before the start',
          'END_BEFORE_START',
        );

      const treatment = await tx.treatment.create({
        data: {
          petId,
          consultationId: data.consultationId ?? null,
          description: data.description,
          startsOn,
          endsOn,
        },
      });
      return toTreatment(treatment);
    });
  }

  async recordExam(
    user: TokenPayload,
    petId: string,
    data: CreateExam,
    key?: string,
  ): Promise<Exam> {
    return this.write('recordExam', user, petId, data, key, async (tx) => {
      const exam = await tx.exam.create({
        data: {
          petId,
          kind: data.kind ?? null,
          performedOn: fromIsoDate(data.performedOn),
          fileUrl: data.fileUrl ?? null,
          result: data.result ?? null,
        },
      });
      return toExam(exam);
    });
  }

  // ---------- Day to day (owner) ----------

  async recordWeight(
    user: TokenPayload,
    petId: string,
    data: CreateWeightEntry,
    key?: string,
  ): Promise<WeightEntry> {
    return this.write('recordWeight', user, petId, data, key, async (tx) => {
      const entry = await tx.weightEntry.create({
        data: {
          petId,
          weightKg: data.weightKg,
          recordedOn:
            fromIsoDateOrUndefined(data.recordedOn) ?? todayInCostaRica(),
        },
      });
      return toWeightEntry(entry);
    });
  }

  async recordFeeding(
    user: TokenPayload,
    petId: string,
    data: CreateFeedingEntry,
    key?: string,
  ): Promise<FeedingEntry> {
    return this.write('recordFeeding', user, petId, data, key, async (tx) => {
      const entry = await tx.feedingEntry.create({
        data: {
          petId,
          notes: data.notes ?? null,
          recordedOn:
            fromIsoDateOrUndefined(data.recordedOn) ?? todayInCostaRica(),
        },
      });
      return toFeedingEntry(entry);
    });
  }
}
