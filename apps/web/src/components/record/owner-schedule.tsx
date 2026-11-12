"use client";

import { OwnerPageSkeleton } from "@/components/owner/owner-page-skeleton";
import { PetScreen } from "@/components/pets/pet-screen";
import { useAlerts, useVaccinationStatus } from "@/hooks/useRecord";
import { Schedule } from "./schedule";

export function OwnerSchedule({ id }: { id: string }) {
  const status = useVaccinationStatus(id);
  const alerts = useAlerts();
  return (
    <PetScreen
      id={id}
      pending={status.isPending || alerts.isPending}
      loading={
        <OwnerPageSkeleton
          page="schedule"
          schedule={status.data}
          hasCalendar={alerts.data?.some((alert) => alert.petId === id && !!alert.dueOn)}
        />
      }
      title="Vacunación y desparasitación"
      description="Lo que registró la clínica. La vigencia de cada dosis sigue el esquema de Costa Rica."
    >
      {(pet) => <Schedule petId={pet.id} petName={pet.name} />}
    </PetScreen>
  );
}
