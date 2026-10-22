"use client";

import { PetScreen } from "@/components/pets/pet-screen";
import { PermissionsManager } from "./permissions-manager";

export function OwnerPermissions({ id }: { id: string }) {
  return (
    <PetScreen
      id={id}
      title="Quién puede ver el expediente"
      description="El expediente es tuyo. Cada acceso es explícito, revocable y queda en bitácora."
    >
      {(pet) => <PermissionsManager petId={pet.id} />}
    </PetScreen>
  );
}
