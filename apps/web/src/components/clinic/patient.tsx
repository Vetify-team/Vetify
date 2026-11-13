"use client";

import { ArrowLeft } from "lucide-react";
import { AssistantIcon } from "@/components/assistant/assistant-icon";
import Link from "next/link";
import { Empty, LoadError, LoadingList } from "@/components/states";
import { Button } from "@/components/ui/button";
import { PetPhoto } from "@/components/pets/pet-photo";
import { ClinicActions } from "@/components/record/clinic-actions";
import { ExamFileButton } from "@/components/record/exam-file-button";
import { History } from "@/components/record/history";
import { Schedule } from "@/components/record/schedule";
import { WeightSeries } from "@/components/record/weight-series";
import { Label, Row, Section } from "@/components/system";
import { usePet } from "@/hooks/usePets";
import { useAssistantPanel } from "@/hooks/useAssistantPanel";
import { useRecord } from "@/hooks/useRecord";
import { ApiRequestError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { speciesLabel } from "@/lib/labels";

/** The shared record seen from the clinic: history on the left, schedule and weight on the right. */
export function Patient({ id }: { id: string }) {
  const pet = usePet(id);
  const record = useRecord(id);
  const showAssistant = useAssistantPanel((s) => s.show);

  if (pet.isPending) return <LoadingList rows={4} />;
  // No full permission: the owner shared only the card, or none at all.
  if (pet.error instanceof ApiRequestError && pet.error.status === 403)
    return (
      <Empty title="No tenés acceso al expediente de esta mascota.">
        <p className="text-muted-foreground">
          Si el dueño compartió solo el carné, lo encontrás en{" "}
          <Link href="/carnes" className="underline underline-offset-4">
            Carnés
          </Link>
          .
        </p>
      </Empty>
    );
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
        <div className="flex items-end gap-5">
          <PetPhoto pet={p} />
          <div>
            <Label>Expediente compartido · permiso de escritura</Label>
            <h1 className="font-display text-5xl font-medium">{p.name}</h1>
            <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
              {meta.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ClinicActions petId={id} />
          <Button variant="solido" onClick={() => showAssistant(id)}>
            <AssistantIcon className="size-4" /> Asistente
          </Button>
        </div>
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
            <WeightSeries petId={id} birthDate={p.birthDate} canRecord={false} />
          </div>
          {record.data && record.data.exams.length > 0 && (
            <Section title="Exámenes">
              {record.data.exams.map((x) => (
                <Row
                  key={x.id}
                  title={x.kind ?? "Examen"}
                  detail={
                    x.fileFormat && (
                      <ExamFileButton petId={id} examId={x.id} format={x.fileFormat} />
                    )
                  }
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
