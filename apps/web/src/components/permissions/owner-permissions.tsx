"use client";

import { PetScreen } from "@/components/pets/pet-screen";
import { PermissionsManager } from "./permissions-manager";

export function OwnerPermissions({ id }: { id: string }) {
  return (
    <PetScreen
      id={id}
      title="Quién puede verlo"
      description="El expediente es tuyo: vos decidís qué clínica lo ve, y podés quitarle el acceso cuando quieras."
    >
      {(pet) => <PermissionsManager petId={pet.id} />}
    </PetScreen>
  );
}
