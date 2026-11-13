"use client";

import { useRouter } from "next/navigation";
import { OwnerPageSkeleton } from "@/components/owner/owner-page-skeleton";
import { PetPicker } from "@/components/pets/pet-picker";
import { PetScreen } from "@/components/pets/pet-screen";
import { useCurrentPet } from "@/hooks/useCurrentPet";
import { usePets } from "@/hooks/usePets";
import { useAlerts, useVaccinationStatus } from "@/hooks/useRecord";
import { Schedule } from "./schedule";

/**
 * A pet's vaccination schedule, with a picker on top to switch pets. The
 * "Esquema" tab opens the pet the owner was looking at (useCurrentPet).
 */
export function OwnerSchedule({ id }: { id: string }) {
  const status = useVaccinationStatus(id);
  const alerts = useAlerts();
  const pets = usePets();
  const select = useCurrentPet((s) => s.select);
  const router = useRouter();

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
      {(pet) => (
        <>
          {pets.data && pets.data.length > 1 && (
            <PetPicker
              pets={pets.data}
              value={pet.id}
              label="Ver el esquema de"
              onChange={(next) => {
                select(next);
                router.replace(`/mascotas/${next}/vacunas`);
              }}
              className="-mt-2 rounded-2xl bg-card p-3 shadow-sm dark:shadow-none dark:ring-1 dark:ring-border"
            />
          )}
          <Schedule petId={pet.id} petName={pet.name} />
        </>
      )}
    </PetScreen>
  );
}
