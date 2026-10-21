"use client";

import type { MedicalRecord } from "@vetify/types";
import { Section } from "@/components/system";
import { dewormingLabel, formatDate } from "@/lib/format";
import { RecordPagination } from "./record-pagination";

interface Entry {
  id: string;
  date: string;
  title: string;
  detail: string;
}

const join = (...parts: (string | null | undefined | false)[]) =>
  parts.filter(Boolean).join(" · ");

/** Everything that happened to the pet, from every clinic and the owner, by date. */
export function historyEntries(record: MedicalRecord): Entry[] {
  const clinic = (id: string | null) => record.clinics.find((c) => c.id === id)?.name;
  const vet = (id: string | null) => record.veterinarians.find((v) => v.id === id)?.name;

  const entries: Entry[] = [
    ...record.consultations.map((c) => ({
      id: c.id,
      date: c.date.slice(0, 10),
      title: c.reason ?? "Consulta",
      detail: join(vet(c.veterinarianId), clinic(c.clinicId), c.diagnosis),
    })),
    ...record.vaccinations.map((v) => ({
      id: v.id,
      date: v.appliedOn,
      title: `Vacuna: ${v.vaccine}`,
      detail: join(
        clinic(v.clinicId),
        v.batch && `lote ${v.batch}`,
        v.expiresOn && `vence ${formatDate(v.expiresOn)}`,
      ),
    })),
    ...record.dewormings.map((d) => ({
      id: d.id,
      date: d.appliedOn,
      title: dewormingLabel(d.kind),
      detail: join(d.product, d.nextDueOn && `próxima ${formatDate(d.nextDueOn)}`),
    })),
    ...record.treatments.map((t) => ({
      id: t.id,
      date: t.startsOn ?? "",
      title: t.description,
      detail: join("Tratamiento", t.endsOn && `hasta ${formatDate(t.endsOn)}`),
    })),
    ...record.exams.map((e) => ({
      id: e.id,
      date: e.performedOn,
      title: e.kind ? `Examen: ${e.kind}` : "Examen",
      detail: join(e.result),
    })),
    ...record.weightEntries.map((w) => ({
      id: w.id,
      date: w.recordedOn,
      title: "Control de peso",
      detail: `${w.weightKg.toLocaleString("es-CR")} kg · dueño`,
    })),
    ...record.feedingEntries.map((f) => ({
      id: f.id,
      date: f.recordedOn,
      title: f.notes ?? "Observación",
      detail: "Observación del dueño",
    })),
  ];

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

const shortDate = new Intl.DateTimeFormat("es-CR", {
  day: "2-digit",
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

/** Timeline of the shared record. */
export function History({ record, petId }: { record: MedicalRecord; petId: string }) {
  const entries = historyEntries(record);
  const clinics = record.clinics.length;

  return (
    <Section
      title="Historial"
      extra={`${clinics} ${clinics === 1 ? "clínica" : "clínicas"} · ${entries.length} registros cargados`}
    >
      {entries.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          Todavía no hay registros. Lo que anoten las clínicas y vos aparece acá.
        </p>
      ) : (
        <ol>
          {entries.map((e) => (
            <li key={e.id} className="fila grid grid-cols-[4.5rem_1fr] gap-3">
              <time dateTime={e.date} className="pt-0.5 text-xs text-muted-foreground">
                {e.date ? shortDate.format(new Date(`${e.date}T00:00:00Z`)) : "—"}
              </time>
              <div className="min-w-0">
                <p>{e.title}</p>
                {e.detail && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{e.detail}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      <RecordPagination petId={petId} />
    </Section>
  );
}
