"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { LoadError, LoadingList } from "@/components/states";
import { ClinicActions } from "@/components/record/clinic-actions";
import { History } from "@/components/record/history";
import { Schedule } from "@/components/record/schedule";
import { WeightSeries } from "@/components/record/weight-series";
import { Label, Row, Section } from "@/components/system";
import { usePet } from "@/hooks/usePets";
import { useRecord } from "@/hooks/useRecord";
import { formatDate, speciesLabel } from "@/lib/format";

/** The shared record seen from the clinic: history on the left, schedule and weight on the right. */
export function Patient({ id }: { id: string }) {
  const pet = usePet(id);
  const record = useRecord(id);

  if (pet.isPending) return <LoadingList rows={4} />;
  if (pet.error) return <LoadError error={pet.error} retry={() => void pet.refetch()} />;

  const p = pet.data;
  const meta = [
    p.breed ?? speciesLabel[p.species],
    [
      p.sex === "male" ? "Macho" : p.sex === "female" ? "Hembra" : null,
      p.neutered ? "esterilizado" : null,
    ]
      .filter(Boolean)
      .join(" · "),
    p.birthDate && `Nac. ${formatDate(p.birthDate)}`,
    p.microchip && `Chip ${p.microchip}`,
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/pacientes"
        className="-mb-4 flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Pacientes
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <Label>Expediente compartido · permiso de escritura</Label>
          <h1 className="font-display text-5xl font-medium">{p.name}</h1>
          <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
            {meta.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </p>
        </div>
        <ClinicActions petId={id} />
      </header>

      <div className="grid gap-10 xl:grid-cols-[1.4fr_1fr]">
        {record.isPending ? (
          <LoadingList rows={5} />
        ) : record.error ? (
          <LoadError error={record.error} retry={() => void record.refetch()} />
        ) : (
          <History record={record.data} petId={id} />
        )}

        <aside className="flex flex-col gap-10 xl:border-l xl:border-border xl:pl-10">
          <div className="flex flex-col gap-3">
            <Label>Esquema</Label>
            <Schedule petId={id} petName={p.name} compact />
          </div>
          <div className="flex flex-col gap-3">
            <Label>Peso</Label>
            <WeightSeries petId={id} canRecord={false} />
          </div>
          {record.data && record.data.exams.length > 0 && (
            <Section title="Exámenes">
              {record.data.exams.map((x) => (
                <Row
                  key={x.id}
                  title={x.kind ?? "Examen"}
                  right={
                    <span className="text-xs text-muted-foreground">
                      {formatDate(x.performedOn)}
                    </span>
                  }
                />
              ))}
            </Section>
          )}
        </aside>
      </div>
    </div>
  );
}
