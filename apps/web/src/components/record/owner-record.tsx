"use client";

import { LoadError, LoadingList } from "@/components/states";
import { ExportPdfButton } from "@/components/pets/export-pdf-button";
import { PetScreen } from "@/components/pets/pet-screen";
import { useRecord } from "@/hooks/useRecord";
import { ActionDialog } from "./action-dialog";
import { ExamForm } from "./exam-form";
import { History } from "./history";
import { FeedingForm } from "./owner-entries";

function Content({ id }: { id: string }) {
  const { data, error, isPending, refetch } = useRecord(id);
  if (isPending) return <LoadingList rows={4} />;
  if (error) return <LoadError error={error} retry={() => void refetch()} />;
  return <History record={data} petId={id} />;
}

/** The owner's record: the history of every clinic and their own day to day. */
export function OwnerRecord({ id }: { id: string }) {
  return (
    <PetScreen
      id={id}
      title="Expediente"
      description="Lo que registró cada clínica y lo que anotaste vos, en una sola historia."
    >
      {(pet) => (
        <>
          <div className="flex flex-wrap items-start gap-2">
            <ExportPdfButton pet={pet} kind="record" />
            <ActionDialog
              text="Agregar examen"
              title="Agregar examen"
              description="Por ejemplo, el resultado de un laboratorio. Queda en el expediente como cargado por vos."
            >
              {(close) => <ExamForm petId={id} onSaved={close} />}
            </ActionDialog>
          </div>
          <Content id={id} />
          <FeedingForm petId={id} />
        </>
      )}
    </PetScreen>
  );
}
