"use client";

import { LoadError, LoadingList } from "@/components/states";
import { PetScreen } from "@/components/pets/pet-screen";
import { useRecord } from "@/hooks/useRecord";
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
      {() => (
        <>
          <Content id={id} />
          <FeedingForm petId={id} />
        </>
      )}
    </PetScreen>
  );
}
