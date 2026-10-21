"use client";

import { PetScreen } from "@/components/pets/pet-screen";
import { Schedule } from "./schedule";

export function OwnerSchedule({ id }: { id: string }) {
  return (
    <PetScreen
      id={id}
      title="Vacunación y desparasitación"
      description="Generado según especie, edad y país. Cada dosis controla su propia vigencia."
    >
      {(pet) => <Schedule petId={pet.id} petName={pet.name} />}
    </PetScreen>
  );
}
