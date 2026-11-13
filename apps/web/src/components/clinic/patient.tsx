"use client";

import { ArrowLeft, CalendarClock, FileText } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";
import { AssistantIcon } from "@/components/assistant/assistant-icon";
import {
  cardSurface,
  DewormingIndicator,
  Indicator,
  VaccineIndicator,
  WeightIndicator,
} from "@/components/pets/panel-parts";
import { PetPhoto } from "@/components/pets/pet-photo";
import { ClinicActions } from "@/components/record/clinic-actions";
import { ExamFileButton } from "@/components/record/exam-file-button";
import { History } from "@/components/record/history";
import { Schedule } from "@/components/record/schedule";
import { WeightSeries } from "@/components/record/weight-series";
import { Empty, LoadError, LoadingList } from "@/components/states";
import { StatusPill } from "@/components/system";
import { Button } from "@/components/ui/button";
import { useAssistantPanel } from "@/hooks/useAssistantPanel";
import { usePet } from "@/hooks/usePets";
import { useRecord } from "@/hooks/useRecord";
import { ApiRequestError } from "@/lib/api-client";
import { age, formatDate } from "@/lib/format";
import { speciesLabel } from "@/lib/labels";

function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn(cardSurface, "flex flex-col gap-4 p-5 sm:p-6", className)}
    >
      <h2 className="font-display text-2xl leading-tight">{title}</h2>
      {children}
    </section>
  );
}

/**
 * A patient's file, the clinic's version of the owner's pet panel: a header
 * with the photo, the record actions at hand, four indicators, and the
 * history, schedule, weight and exams in cards.
 */
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
  const facts = [
    p.breed ?? speciesLabel[p.species],
    p.sex === "male" ? "Macho" : p.sex === "female" ? "Hembra" : null,
    p.neutered ? "esterilizado" : null,
    age(p.birthDate),
  ].filter(Boolean);
  const lastConsultation = record.data?.consultations[0];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <Link
        href="/pacientes"
        className="-mb-2 flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Pacientes
      </Link>

      <header
        className={cn(
          cardSurface,
          "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 gap-y-5 p-5 sm:p-6 lg:grid-cols-[auto_minmax(0,1fr)_auto]",
        )}
      >
        <PetPhoto pet={p} size="lg" />
        <div className="min-w-0">
          <h1 className="font-display text-5xl leading-none font-medium break-words">
            {p.name}
          </h1>
          <p className="mt-2 text-muted-foreground">{facts.join(" · ")}</p>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <StatusPill tone="ok">Expediente compartido</StatusPill>
            {p.birthDate && <span>Nac. {formatDate(p.birthDate)}</span>}
            {p.microchip && <span className="font-mono">Chip {p.microchip}</span>}
          </p>
        </div>
        <div className="col-span-2 flex flex-col gap-2 lg:col-span-1 lg:items-end">
          <p className="text-xs text-muted-foreground">Registrar en el expediente</p>
          <ClinicActions petId={id} />
          <Button
            variant="outline"
            className="h-11 gap-2 sm:h-10"
            onClick={() => showAssistant(id)}
          >
            <AssistantIcon className="size-4" /> Asistente
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <VaccineIndicator petId={id} href="#esquema" />
        <WeightIndicator petId={id} href="#peso" />
        <DewormingIndicator petId={id} href="#esquema" />
        <Indicator href="#historial" icon={CalendarClock} label="Última consulta">
          <span className="font-display text-2xl leading-none">
            {record.isPending
              ? "…"
              : lastConsultation
                ? formatDate(lastConsultation.date)
                : "Ninguna"}
          </span>
          <span className="line-clamp-1 text-xs text-muted-foreground">
            {lastConsultation?.reason ??
              lastConsultation?.diagnosis ??
              "Sin consultas registradas"}
          </span>
        </Indicator>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section
          id="historial"
          aria-label="Historial"
          className={cn(cardSurface, "scroll-mt-6 p-5 sm:p-6")}
        >
          {record.isPending ? (
            <LoadingList rows={5} />
          ) : record.error ? (
            <LoadError error={record.error} retry={() => void record.refetch()} />
          ) : (
            <History record={record.data} petId={id} />
          )}
        </section>

        <div className="flex flex-col gap-4">
          <div id="esquema" className="scroll-mt-6">
            <Panel title="Esquema">
              <Schedule petId={id} petName={p.name} compact />
            </Panel>
          </div>
          <div id="peso" className="scroll-mt-6">
            <Panel title="Peso">
              <WeightSeries petId={id} birthDate={p.birthDate} canRecord={false} />
            </Panel>
          </div>
          {record.data && record.data.exams.length > 0 && (
            <Panel title="Exámenes">
              <ul className="flex flex-col divide-y divide-border/70">
                {record.data.exams.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-3 py-3">
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <FileText className="size-4 text-muted-foreground" aria-hidden />
                        {x.kind ?? "Examen"}
                      </span>
                      {x.fileFormat && (
                        <ExamFileButton petId={id} examId={x.id} format={x.fileFormat} />
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(x.performedOn)}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
