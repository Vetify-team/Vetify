"use client";

import { createPetSchema } from "@vetify/types";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field, FormError, Select } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { useCreatePet } from "@/hooks/usePets";
import { errorMessage } from "@/lib/errors";
import { today } from "@/lib/format";
import { apiFieldErrors, validateForm, type FieldErrors } from "@/lib/forms";

export function PetForm() {
  const create = useCreatePet();
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { data, errors } = validateForm(event.currentTarget, createPetSchema, (d) => ({
      ...d,
      neutered: d.neutered === "yes",
    }));
    setErrors(errors ?? {});
    if (!data) return;
    create.mutate(data, {
      onSuccess: (pet) => router.replace(`/mascotas/${pet.id}`),
      onError: (error) => setErrors(apiFieldErrors(error)),
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field label="Nombre" name="name" error={errors.name} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Especie"
          name="species"
          options={[
            { value: "dog", text: "Perro" },
            { value: "cat", text: "Gato" },
            { value: "other", text: "Otra" },
          ]}
          error={errors.species}
        />
        <Field
          label="Raza"
          name="breed"
          placeholder="Ej.: zaguate"
          error={errors.breed}
        />
        <Select
          label="Sexo"
          name="sex"
          options={[
            { value: "", text: "Sin indicar" },
            { value: "female", text: "Hembra" },
            { value: "male", text: "Macho" },
          ]}
          error={errors.sex}
        />
        <Field
          label="Fecha de nacimiento"
          name="birthDate"
          type="date"
          max={today()}
          error={errors.birthDate}
          hint="Se usa para calcular qué vacunas le tocan."
        />
        <Select
          label="¿Está esterilizada?"
          name="neutered"
          options={[
            { value: "no", text: "No" },
            { value: "yes", text: "Sí" },
          ]}
        />
        <Field label="Microchip (opcional)" name="microchip" error={errors.microchip} />
      </div>
      <FormError message={create.isError ? errorMessage(create.error) : null} />
      <Button type="submit" size="lg" disabled={create.isPending}>
        {create.isPending ? "Guardando…" : "Registrar mascota"}
      </Button>
    </form>
  );
}
