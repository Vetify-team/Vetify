import type { MedicalRecord, Pet, VaccinationStatus } from "@vetify/types";
import { formatDate } from "./format";
import { dewormingLabel, sexLabel, speciesLabel } from "./labels";
import { recordedVaccines } from "./vaccination";

/**
 * What the PDF exports say, as plain data: titles, key/value facts and
 * tables. Pure (no jsPDF, no React) so the content is tested on its own;
 * lib/pdf.ts only draws it.
 */

export interface PdfTable {
  title: string;
  head: string[];
  rows: string[][];
  empty: string;
}

export interface PdfDocument {
  title: string;
  subtitle: string;
  facts: [string, string][];
  tables: PdfTable[];
  note: string;
}

const text = (value: string | null | undefined): string => value?.trim() || "—";

/** Name, species, breed, sex, birth date, neutered, microchip. */
export function petFacts(pet: Pet): [string, string][] {
  return [
    ["Especie", speciesLabel[pet.species]],
    ["Raza", text(pet.breed)],
    ["Sexo", pet.sex ? sexLabel[pet.sex] : "—"],
    ["Nacimiento", formatDate(pet.birthDate)],
    ["Esterilizado", pet.neutered ? "Sí" : "No"],
    ["Microchip", text(pet.microchip)],
  ];
}

const STATE_TEXT: Record<string, string> = {
  valid: "Vigente",
  expiring: "Por vencer",
  expired: "Vencida",
  due: "Pendiente",
  not_yet_due: "Aún no corresponde",
};

/** The vaccination card: status of each vaccine and deworming. */
export function cardDocument(
  pet: Pet,
  status: VaccinationStatus,
  issuedOn: string,
): PdfDocument {
  return {
    title: `Carné de vacunación · ${pet.name}`,
    subtitle: `Emitido el ${formatDate(issuedOn)} · Esquema de Costa Rica`,
    facts: petFacts(pet),
    tables: [
      {
        title: "Vacunas",
        head: ["Vacuna", "Estado", "Última dosis", "Vence"],
        rows: recordedVaccines(status).map((v) => [
          v.vaccine,
          STATE_TEXT[v.status] ?? v.status,
          formatDate(v.lastAppliedOn),
          formatDate(v.expiresOn),
        ]),
        empty: "Sin vacunas registradas.",
      },
      {
        title: "Desparasitaciones",
        head: ["Tipo", "Producto", "Aplicada", "Próxima"],
        rows: status.dewormings.map((d) => [
          dewormingLabel(d.kind),
          text(d.product),
          formatDate(d.lastAppliedOn),
          formatDate(d.nextDueOn),
        ]),
        empty: "Sin desparasitaciones registradas.",
      },
    ],
    note: "Para confirmar la vigencia, escaneá el código QR o pedí el enlace de verificación al dueño.",
  };
}

/** The full record, newest first in every section. */
export function recordDocument(
  pet: Pet,
  record: MedicalRecord,
  issuedOn: string,
): PdfDocument {
  const clinic = new Map(record.clinics.map((c) => [c.id, c.name]));
  const vet = new Map(record.veterinarians.map((v) => [v.id, v.name]));
  // Who signed each act: the clinic and the veterinarian of its team.
  const signedBy = (act: { clinicId: string | null; veterinarianId: string | null }) =>
    [clinic.get(act.clinicId ?? ""), vet.get(act.veterinarianId ?? "")]
      .filter(Boolean)
      .join(" · ") || "—";
  const byDate = <T>(items: T[], date: (item: T) => string | null) =>
    [...items].sort((a, b) => (date(b) ?? "").localeCompare(date(a) ?? ""));

  return {
    title: `Expediente clínico · ${pet.name}`,
    subtitle: `Emitido el ${formatDate(issuedOn)}`,
    facts: petFacts(pet),
    tables: [
      {
        title: "Consultas",
        head: ["Fecha", "Clínica", "Motivo", "Diagnóstico"],
        rows: byDate(record.consultations, (c) => c.date).map((c) => [
          formatDate(c.date),
          signedBy(c),
          text(c.reason),
          text(c.diagnosis),
        ]),
        empty: "Sin consultas.",
      },
      {
        title: "Vacunas",
        head: ["Aplicada", "Clínica", "Vacuna", "Lote", "Vence"],
        rows: byDate(record.vaccinations, (v) => v.appliedOn).map((v) => [
          formatDate(v.appliedOn),
          signedBy(v),
          v.vaccine,
          text(v.batch),
          formatDate(v.expiresOn),
        ]),
        empty: "Sin vacunas.",
      },
      {
        title: "Desparasitaciones",
        head: ["Aplicada", "Clínica", "Tipo", "Producto", "Próxima"],
        rows: byDate(record.dewormings, (d) => d.appliedOn).map((d) => [
          formatDate(d.appliedOn),
          signedBy(d),
          dewormingLabel(d.kind),
          text(d.product),
          formatDate(d.nextDueOn),
        ]),
        empty: "Sin desparasitaciones.",
      },
      {
        title: "Tratamientos",
        head: ["Inicio", "Fin", "Clínica", "Tratamiento"],
        rows: byDate(record.treatments, (t) => t.startsOn).map((t) => [
          formatDate(t.startsOn),
          formatDate(t.endsOn),
          signedBy(t),
          t.description,
        ]),
        empty: "Sin tratamientos.",
      },
      {
        title: "Exámenes",
        head: ["Fecha", "Clínica", "Examen", "Resultado"],
        rows: byDate(record.exams, (e) => e.performedOn).map((e) => [
          formatDate(e.performedOn),
          e.recordedByOwner ? "Dueño" : signedBy(e),
          text(e.kind),
          text(e.result),
        ]),
        empty: "Sin exámenes.",
      },
      {
        title: "Peso",
        head: ["Fecha", "Peso"],
        rows: byDate(record.weightEntries, (w) => w.recordedOn).map((w) => [
          formatDate(w.recordedOn),
          `${w.weightKg.toLocaleString("es-CR")} kg`,
        ]),
        empty: "Sin registros de peso.",
      },
      {
        title: "Alimentación y observaciones",
        head: ["Fecha", "Detalle"],
        rows: byDate(record.feedingEntries, (f) => f.recordedOn).map((f) => [
          formatDate(f.recordedOn),
          text(f.notes),
        ]),
        empty: "Sin observaciones.",
      },
    ],
    note: "Documento generado por el dueño desde Vetify. El expediente pertenece al dueño; cada clínica registró sus actos con su permiso.",
  };
}

/** "Expediente-Luna-2026-11-07.pdf": safe for every file system. */
export function pdfFileName(
  kind: "Carne" | "Expediente",
  petName: string,
  issuedOn: string,
): string {
  const name =
    petName
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "mascota";
  return `${kind}-${name}-${issuedOn}.pdf`;
}
