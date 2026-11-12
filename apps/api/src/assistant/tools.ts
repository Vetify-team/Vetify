import type {
  Consultation,
  Deworming,
  Exam,
  FeedingEntry,
  MedicalRecord,
  Participant,
  Pet,
  RecordSection,
  TokenPayload,
  Treatment,
  Vaccination,
  VaccinationStatus,
  VaccineStatus,
  WeightEntry,
} from '@vetify/types';
import { fromIsoDate, toIsoDate, todayInCostaRica } from '../common/dates.js';
import {
  EXPIRY_WARNING_DAYS,
  normalizeName,
  statusByDate,
} from '../records/vaccination.js';
import type { PetsService } from '../pets/pets.service.js';
import type { RecordsService } from '../records/records.service.js';
import type { VaccinationStatusService } from '../records/vaccination-status.service.js';
import type { LlmTool } from './llm.client.js';

/** Newest entries per section sent to the model, to bound tokens. */
export const TOOL_RECORD_LIMIT = 20;
/** Weights in the summary preloaded in the system message. */
export const SUMMARY_WEIGHTS = 5;

/** The services the tools read through, as the authenticated user. */
export interface AssistantToolServices {
  pets: Pick<PetsService, 'get'>;
  records: Pick<RecordsService, 'get'>;
  vaccinationStatus: Pick<VaccinationStatusService, 'vaccinationStatus'>;
}

// ---------- Compact DTOs: what the language model provider receives ----------
//
// Built field by field (never spread), so a field added to a contract later
// does not reach the provider by accident. No owner data, no microchip, no
// photo, no pet name and no user or clinic ids: only species, age and the
// clinical facts, each with its date and record id. The one exception is
// who signed a vaccine (clinic and veterinarian by name, never their ids),
// in the vaccination history.

/** Whole years and remaining months between two YYYY-MM-DD dates. */
export function ageBetween(
  birthDate: string,
  today: string,
): { years: number; months: number } | null {
  const [by, bm, bd] = birthDate.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number];
  let months = (ty - by) * 12 + (tm - bm) - (td < bd ? 1 : 0);
  if (months < 0) return null;
  const years = Math.floor(months / 12);
  months -= years * 12;
  return { years, months };
}

export const toPetProfile = (pet: Pet, today: string) => ({
  species: pet.species,
  breed: pet.breed,
  sex: pet.sex,
  neutered: pet.neutered,
  age: pet.birthDate ? ageBetween(pet.birthDate, today) : null,
});

/**
 * Status in words, computed by the API against today in Costa Rica (the same
 * rule as the card and the reminders), so the model never works it out from
 * dates. "por vencer": expires within EXPIRY_WARNING_DAYS days.
 */
export const STATUS_LABEL: Record<VaccineStatus, string> = {
  valid: 'vigente',
  expiring: 'por vencer',
  expired: 'vencida',
  due: 'pendiente',
  not_yet_due: 'aún no corresponde',
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from today to a YYYY-MM-DD date; negative when it is past. */
export const daysFrom = (today: Date, date: string | null): number | null =>
  date === null
    ? null
    : Math.round((fromIsoDate(date).getTime() - today.getTime()) / DAY_MS);

export const toVaccinationStatusDto = (
  status: VaccinationStatus,
  today: Date,
) => ({
  country: status.country,
  coveragePercent: status.coverage,
  vaccines: status.vaccines.map((v) => ({
    vaccine: v.vaccine,
    status: STATUS_LABEL[v.status],
    lastAppliedOn: v.lastAppliedOn,
    expiresOn: v.expiresOn,
    daysUntilExpiry: daysFrom(today, v.expiresOn),
    nextDueOn: v.nextDueOn,
  })),
  dewormings: status.dewormings.map((d) => ({
    kind: d.kind,
    product: d.product,
    status: STATUS_LABEL[d.status],
    lastAppliedOn: d.lastAppliedOn,
    nextDueOn: d.nextDueOn,
    daysUntilNextDose: daysFrom(today, d.nextDueOn),
  })),
});

const nameOf = (people: Participant[], id: string | null) =>
  (id && people.find((p) => p.id === id)?.name) || null;

/**
 * The vaccination history: every dose as the clinic recorded it, newest
 * first. The status of each dose is computed here from its expiry; a dose
 * followed by a later one of the same vaccine is marked as replaced, so an
 * old expired dose does not read as an unprotected pet.
 */
export const toVaccinationHistory = (
  record: Pick<MedicalRecord, 'vaccinations' | 'clinics' | 'veterinarians'>,
  today: Date,
) => {
  const newestFirst = [...record.vaccinations].sort((a, b) =>
    b.appliedOn.localeCompare(a.appliedOn),
  );
  const seen = new Set<string>();
  return newestFirst.map((v: Vaccination) => {
    const key = normalizeName(v.vaccine);
    const replacedByLaterDose = seen.has(key);
    seen.add(key);
    const clinic = nameOf(record.clinics, v.clinicId);
    const veterinarian = nameOf(record.veterinarians, v.veterinarianId);
    return {
      id: v.id,
      vaccine: v.vaccine,
      appliedOn: v.appliedOn,
      expiresOn: v.expiresOn,
      status: v.expiresOn
        ? STATUS_LABEL[statusByDate(fromIsoDate(v.expiresOn), today)]
        : 'sin fecha de vencimiento registrada',
      daysUntilExpiry: daysFrom(today, v.expiresOn),
      replacedByLaterDose,
      signedBy: clinic || veterinarian ? { clinic, veterinarian } : null,
    };
  });
};

export const toConsultationDto = (c: Consultation) => ({
  id: c.id,
  date: c.date,
  reason: c.reason,
  diagnosis: c.diagnosis,
  notes: c.notes,
});

export const toTreatmentDto = (t: Treatment) => ({
  id: t.id,
  consultationId: t.consultationId,
  description: t.description,
  startsOn: t.startsOn,
  endsOn: t.endsOn,
});

export const toDewormingDto = (d: Deworming) => ({
  id: d.id,
  appliedOn: d.appliedOn,
  kind: d.kind,
  product: d.product,
  nextDueOn: d.nextDueOn,
});

export const toExamDto = (e: Exam) => ({
  id: e.id,
  performedOn: e.performedOn,
  kind: e.kind,
  result: e.result,
  hasFile: Boolean(e.fileUrl || e.fileFormat),
  recordedByOwner: e.recordedByOwner,
});

export const toWeightDto = (w: WeightEntry) => ({
  id: w.id,
  recordedOn: w.recordedOn,
  weightKg: w.weightKg,
});

export const toFeedingDto = (f: FeedingEntry) => ({
  id: f.id,
  recordedOn: f.recordedOn,
  notes: f.notes,
});

/** A treatment that has started (or has no start) and has not ended. */
export const isActiveTreatment = (t: Treatment, today: string): boolean =>
  (!t.startsOn || t.startsOn <= today) && (!t.endsOn || t.endsOn >= today);

// ---------- Tool definitions ----------

const NO_PARAMETERS = {
  type: 'object',
  properties: {},
  additionalProperties: false,
};

const tool = (name: string, description: string): LlmTool => ({
  name,
  description,
  parameters: NO_PARAMETERS,
});

/**
 * Every tool reads the pet of the conversation; none takes a pet id, so the
 * model cannot ask for another pet's record.
 */
export const ASSISTANT_TOOLS: LlmTool[] = [
  tool(
    'get_pet_profile',
    'Perfil de la mascota: especie, raza, sexo, si está esterilizada y edad.',
  ),
  tool(
    'get_vaccination_status',
    `Estado del esquema de vacunación y desparasitación, ya calculado al día de hoy: vigente, por vencer (${EXPIRY_WARNING_DAYS} días o menos), vencida, pendiente o aún no corresponde, con fechas y días que faltan.`,
  ),
  tool(
    'list_vaccinations',
    `Historial real de vacunas aplicadas (las últimas ${TOOL_RECORD_LIMIT}), con el nombre tal como se registró: fecha de aplicación, vencimiento, estado ya calculado, si una dosis posterior la reemplazó y quién la firmó (clínica y veterinario), si consta. Incluye vacunas que no son del esquema.`,
  ),
  tool(
    'list_consultations',
    `Últimas ${TOOL_RECORD_LIMIT} consultas veterinarias: fecha, motivo, diagnóstico y notas.`,
  ),
  tool(
    'list_treatments',
    `Últimos ${TOOL_RECORD_LIMIT} tratamientos: descripción, inicio y fin.`,
  ),
  tool(
    'list_dewormings',
    `Últimas ${TOOL_RECORD_LIMIT} desparasitaciones: fecha, tipo, producto y próxima fecha.`,
  ),
  tool(
    'list_exams',
    `Últimos ${TOOL_RECORD_LIMIT} exámenes: fecha, tipo y resultado.`,
  ),
  tool(
    'get_weight_series',
    `Últimos ${TOOL_RECORD_LIMIT} registros de peso en kg, del más antiguo al más reciente.`,
  ),
  tool(
    'list_feeding',
    `Últimos ${TOOL_RECORD_LIMIT} registros de alimentación anotados por el dueño.`,
  ),
];

/**
 * Runs a tool for the conversation's pet with the authenticated user. Each
 * call goes through the record services, so it is authorized again by
 * PermissionsService.authorize (a permission revoked mid-conversation stops
 * the next call). Returns the compact JSON sent back to the model.
 */
export class AssistantTools {
  constructor(
    private readonly services: AssistantToolServices,
    private readonly user: TokenPayload,
    private readonly petId: string,
    /** Today in Costa Rica; statuses and ages are computed against it. */
    private readonly today: Date = todayInCostaRica(),
  ) {}

  /**
   * Compact summary preloaded in the system message, so most questions are
   * answered in one model call: profile, vaccination status and history,
   * active treatments, the last ${SUMMARY_WEIGHTS} weights and the last
   * consultation. Read through the same services and DTOs as the tools.
   */
  async summary() {
    const today = toIsoDate(this.today);
    const [pet, status, record] = await Promise.all([
      this.services.pets.get(this.user, this.petId),
      this.services.vaccinationStatus.vaccinationStatus(this.user, this.petId),
      this.services.records.get(this.user, this.petId, {
        limit: TOOL_RECORD_LIMIT,
      }),
    ]);
    const lastConsultation = record.consultations[0];
    return {
      profile: toPetProfile(pet, today),
      vaccinationStatus: toVaccinationStatusDto(status, this.today),
      vaccinationHistory: toVaccinationHistory(record, this.today),
      activeTreatments: record.treatments
        .filter((t) => isActiveTreatment(t, today))
        .map(toTreatmentDto),
      // Newest first in the record; the summary reads oldest first.
      recentWeights: record.weightEntries
        .slice(0, SUMMARY_WEIGHTS)
        .map(toWeightDto)
        .reverse(),
      lastConsultation: lastConsultation
        ? toConsultationDto(lastConsultation)
        : null,
    };
  }

  async run(name: string): Promise<string> {
    const result = await this.dispatch(name);
    return JSON.stringify(result);
  }

  private section<S extends RecordSection>(section: S) {
    return this.services.records.get(this.user, this.petId, {
      limit: TOOL_RECORD_LIMIT,
      section,
    });
  }

  private async dispatch(name: string): Promise<unknown> {
    switch (name) {
      case 'get_pet_profile': {
        const pet = await this.services.pets.get(this.user, this.petId);
        return toPetProfile(pet, toIsoDate(this.today));
      }
      case 'get_vaccination_status':
        return toVaccinationStatusDto(
          await this.services.vaccinationStatus.vaccinationStatus(
            this.user,
            this.petId,
          ),
          this.today,
        );
      case 'list_vaccinations':
        return {
          vaccinations: toVaccinationHistory(
            await this.section('vaccinations'),
            this.today,
          ),
        };
      case 'list_consultations':
        return {
          consultations: (
            await this.section('consultations')
          ).consultations.map(toConsultationDto),
        };
      case 'list_treatments':
        return {
          treatments: (await this.section('treatments')).treatments.map(
            toTreatmentDto,
          ),
        };
      case 'list_dewormings':
        return {
          dewormings: (await this.section('dewormings')).dewormings.map(
            toDewormingDto,
          ),
        };
      case 'list_exams':
        return {
          exams: (await this.section('exams')).exams.map(toExamDto),
        };
      case 'get_weight_series':
        return {
          // The record lists newest first; a series reads better in order.
          weights: (await this.section('weightEntries')).weightEntries
            .map(toWeightDto)
            .reverse(),
        };
      case 'list_feeding':
        return {
          feeding: (await this.section('feedingEntries')).feedingEntries.map(
            toFeedingDto,
          ),
        };
      default:
        return { error: `Unknown tool: ${name.slice(0, 64)}` };
    }
  }
}
