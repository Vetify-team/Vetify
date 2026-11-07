"use client";

import { PetScreen } from "@/components/pets/pet-screen";
import { WeightSeries } from "./weight-series";

export function OwnerWeight({ id }: { id: string }) {
  return (
    <PetScreen id={id} title="Serie de peso">
      {(pet) => <WeightSeries petId={pet.id} canRecord />}
    </PetScreen>
  );
}
