import { z } from "zod";
import {
  dateIssue,
  dateSchema,
  dateTimeSchema,
  httpsUrlSchema,
  idSchema,
  multilineTextSchema,
  pageQuerySchema,
  pastDateSchema,
  scheduleDateSchema,
  textSchema,
} from "./common.js";
import { speciesSchema } from "./pet.js";

// ---------- Medical acts: written by a clinic with an active permission ----------

export const consultationSchema = z.object({
  id: idSchema,
  petId: idSchema,
  clinicId: idSchema.nullable(),
  veterinarianId: idSchema.nullable(),
  date: dateTimeSchema,
  reason: z.string().nullable(),
  diagnosis: z.string().nullable(),
  notes: z.string().nullable(),
});
export type Consultation = z.infer<typeof consultationSchema>;

export const createConsultationSchema = z.object({
  /** Defaults to now. Cannot be in the future. */
  date: dateTimeSchema
    .refine(
      (value) => Date.parse(value) <= Date.now() + 60_000,
      dateIssue("Date cannot be in the future", "DATE_IN_FUTURE"),
    )
    .optional(),
  reason: textSchema(300).optional(),
  diagnosis: multilineTextSchema(2000).optional(),
  notes: multilineTextSchema(4000).optional(),
});
export type CreateConsultation = z.infer<typeof createConsultationSchema>;

export const vaccinationSchema = z.object({
  id: idSchema,
  petId: idSchema,
  vaccine: z.string(),
  batch: z.string().nullable(),
  appliedOn: dateSchema,
  expiresOn: dateSchema.nullable(),
  clinicId: idSchema.nullable(),
});
export type Vaccination = z.infer<typeof vaccinationSchema>;

export const createVaccinationSchema = z.object({
  vaccine: textSchema(120).min(1, { error: "Vaccine is required" }),
  batch: textSchema(60).optional(),
  appliedOn: pastDateSchema,
  /** If omitted, computed from the country's schedule. */
  expiresOn: scheduleDateSchema.optional(),
});
export type CreateVaccination = z.infer<typeof createVaccinationSchema>;

export const dewormingKindSchema = z.enum(["internal", "external"]);
export type DewormingKind = z.infer<typeof dewormingKindSchema>;

export const dewormingSchema = z.object({
  id: idSchema,
  petId: idSchema,
  product: z.string().nullable(),
  kind: z.string().nullable(),
  appliedOn: dateSchema,
  nextDueOn: dateSchema.nullable(),
});
export type Deworming = z.infer<typeof dewormingSchema>;

export const createDewormingSchema = z.object({
  product: textSchema(120).optional(),
  kind: dewormingKindSchema.optional(),
  appliedOn: pastDateSchema,
  nextDueOn: scheduleDateSchema.optional(),
});
export type CreateDeworming = z.infer<typeof createDewormingSchema>;

export const treatmentSchema = z.object({
  id: idSchema,
  consultationId: idSchema.nullable(),
  petId: idSchema,
  description: z.string(),
  startsOn: dateSchema.nullable(),
  endsOn: dateSchema.nullable(),
});
export type Treatment = z.infer<typeof treatmentSchema>;

export const createTreatmentSchema = z.object({
  consultationId: idSchema.optional(),
  description: multilineTextSchema(2000).min(1, { error: "Description is required" }),
  startsOn: scheduleDateSchema.optional(),
  endsOn: scheduleDateSchema.optional(),
});
export type CreateTreatment = z.infer<typeof createTreatmentSchema>;

export const examSchema = z.object({
  id: idSchema,
  petId: idSchema,
  kind: z.string().nullable(),
  performedOn: dateSchema,
  fileUrl: z.string().nullable(),
  result: z.string().nullable(),
});
export type Exam = z.infer<typeof examSchema>;

export const createExamSchema = z.object({
  kind: textSchema(120).optional(),
  performedOn: pastDateSchema,
  fileUrl: httpsUrlSchema.optional(),
  result: multilineTextSchema(4000).optional(),
});
export type CreateExam = z.infer<typeof createExamSchema>;

// ---------- Day to day: written by the owner ----------

export const weightEntrySchema = z.object({
  id: idSchema,
  petId: idSchema,
  recordedOn: dateSchema,
  weightKg: z.number(),
});
export type WeightEntry = z.infer<typeof weightEntrySchema>;

export const createWeightEntrySchema = z.object({
  recordedOn: pastDateSchema.optional(),
  weightKg: z.number().positive({ error: "Weight must be greater than zero" }).max(200),
});
export type CreateWeightEntry = z.infer<typeof createWeightEntrySchema>;

export const feedingEntrySchema = z.object({
  id: idSchema,
  petId: idSchema,
  recordedOn: dateSchema,
  notes: z.string().nullable(),
});
export type FeedingEntry = z.infer<typeof feedingEntrySchema>;

export const createFeedingEntrySchema = z.object({
  recordedOn: pastDateSchema.optional(),
  notes: multilineTextSchema(1000).optional(),
});
export type CreateFeedingEntry = z.infer<typeof createFeedingEntrySchema>;

// ---------- Preventive schedule and alerts ----------

/**
 * Status of a vaccine of the schedule for a given pet:
 * - `valid`: applied, protection lasts more than 30 days.
 * - `expiring`: applied, expires in 30 days or less.
 * - `expired`: applied, protection already ended.
 * - `due`: never applied and the pet is old enough.
 * - `not_yet_due`: the pet is not old enough yet.
 */
export const vaccineStatusSchema = z.enum([
  "valid",
  "expiring",
  "expired",
  "due",
  "not_yet_due",
]);
export type VaccineStatus = z.infer<typeof vaccineStatusSchema>;

export const scheduledVaccineSchema = z.object({
  vaccine: z.string(),
  status: vaccineStatusSchema,
  lastAppliedOn: dateSchema.nullable(),
  expiresOn: dateSchema.nullable(),
  /** When it is due: expiry, minimum age, or null when already overdue. */
  nextDueOn: dateSchema.nullable(),
});
export type ScheduledVaccine = z.infer<typeof scheduledVaccineSchema>;

/** Latest deworming of each kind and when the next one is due. */
export const dewormingStatusSchema = z.object({
  kind: z.string().nullable(),
  product: z.string().nullable(),
  lastAppliedOn: dateSchema,
  nextDueOn: dateSchema.nullable(),
  status: vaccineStatusSchema,
});
export type DewormingStatus = z.infer<typeof dewormingStatusSchema>;

/** The country/species schedule crossed with what was applied. */
export const vaccinationStatusSchema = z.object({
  country: z.string().length(2),
  species: speciesSchema,
  /** Percentage of the schedule currently protected (includes `expiring`). */
  coverage: z.number().min(0).max(100),
  vaccines: z.array(scheduledVaccineSchema),
  dewormings: z.array(dewormingStatusSchema),
});
export type VaccinationStatus = z.infer<typeof vaccinationStatusSchema>;

/** Overdue or upcoming dose of a pet visible to the user. */
export const alertSchema = z.object({
  petId: idSchema,
  petName: z.string(),
  kind: z.enum(["vaccination", "deworming"]),
  /** Vaccine name or deworming kind. */
  name: z.string(),
  dueOn: dateSchema.nullable(),
  status: vaccineStatusSchema,
});
export type Alert = z.infer<typeof alertSchema>;

/** Someone who appears in the record, to show "Dr. X · Clinic Y". */
export const participantSchema = z.object({ id: idSchema, name: z.string() });
export type Participant = z.infer<typeof participantSchema>;

export const recordSectionSchema = z.enum([
  "consultations",
  "vaccinations",
  "dewormings",
  "treatments",
  "exams",
  "weightEntries",
  "feedingEntries",
]);
export type RecordSection = z.infer<typeof recordSectionSchema>;

/** First request returns a bounded page of each section; subsequent requests select one. */
export const recordQuerySchema = pageQuerySchema
  .extend({
    section: recordSectionSchema.optional(),
    cursor: idSchema.optional(),
  })
  .refine((query) => !query.cursor || !!query.section, {
    error: "A cursor requires a section",
    path: ["section"],
  });
export type RecordQuery = z.infer<typeof recordQuerySchema>;

/** A bounded page of a pet's record. Omitted nextCursors entries have no more rows. */
export const medicalRecordSchema = z.object({
  nextCursors: z.partialRecord(recordSectionSchema, idSchema),
  clinics: z.array(participantSchema),
  veterinarians: z.array(participantSchema),
  consultations: z.array(consultationSchema),
  vaccinations: z.array(vaccinationSchema),
  dewormings: z.array(dewormingSchema),
  treatments: z.array(treatmentSchema),
  exams: z.array(examSchema),
  weightEntries: z.array(weightEntrySchema),
  feedingEntries: z.array(feedingEntrySchema),
});
export type MedicalRecord = z.infer<typeof medicalRecordSchema>;

/** What a POST to each record section accepts. */
export type CreateEntry = {
  consultations: CreateConsultation;
  vaccinations: CreateVaccination;
  dewormings: CreateDeworming;
  treatments: CreateTreatment;
  exams: CreateExam;
  weightEntries: CreateWeightEntry;
  feedingEntries: CreateFeedingEntry;
};
