import type {
  Consultation,
  Deworming,
  Exam,
  FeedingEntry,
  Treatment,
  Vaccination,
  WeightEntry,
} from '@vetify/types';
import { toIsoDate, toIsoDateOrNull, toIsoDateTime } from '../common/dates.js';
import type {
  Consultation as ConsultationRow,
  Deworming as DewormingRow,
  Exam as ExamRow,
  FeedingEntry as FeedingEntryRow,
  Treatment as TreatmentRow,
  Vaccination as VaccinationRow,
  WeightEntry as WeightEntryRow,
} from '../generated/prisma/client.js';

export const toConsultation = (c: ConsultationRow): Consultation => ({
  id: c.id,
  petId: c.petId,
  clinicId: c.clinicId,
  veterinarianId: c.veterinarianId,
  date: toIsoDateTime(c.date),
  reason: c.reason,
  diagnosis: c.diagnosis,
  notes: c.notes,
});

export const toVaccination = (v: VaccinationRow): Vaccination => ({
  id: v.id,
  petId: v.petId,
  vaccine: v.vaccine,
  batch: v.batch,
  appliedOn: toIsoDate(v.appliedOn),
  expiresOn: toIsoDateOrNull(v.expiresOn),
  clinicId: v.clinicId,
});

export const toDeworming = (d: DewormingRow): Deworming => ({
  id: d.id,
  petId: d.petId,
  product: d.product,
  kind: d.kind,
  appliedOn: toIsoDate(d.appliedOn),
  nextDueOn: toIsoDateOrNull(d.nextDueOn),
});

export const toTreatment = (t: TreatmentRow): Treatment => ({
  id: t.id,
  consultationId: t.consultationId,
  petId: t.petId,
  description: t.description,
  startsOn: toIsoDateOrNull(t.startsOn),
  endsOn: toIsoDateOrNull(t.endsOn),
});

export const toExam = (e: ExamRow): Exam => ({
  id: e.id,
  petId: e.petId,
  kind: e.kind,
  performedOn: toIsoDate(e.performedOn),
  fileUrl: e.fileUrl,
  result: e.result,
});

export const toWeightEntry = (w: WeightEntryRow): WeightEntry => ({
  id: w.id,
  petId: w.petId,
  recordedOn: toIsoDate(w.recordedOn),
  weightKg: w.weightKg.toNumber(),
});

export const toFeedingEntry = (f: FeedingEntryRow): FeedingEntry => ({
  id: f.id,
  petId: f.petId,
  recordedOn: toIsoDate(f.recordedOn),
  notes: f.notes,
});
