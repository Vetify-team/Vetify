"use client";

import { createPetSchema } from "@vetify/types";
import { useQueryClient } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { FilePreview } from "@/components/file-upload";
import { Field, FormError, Select } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { keys } from "@/hooks/keys";
import { useCreatePet } from "@/hooks/usePets";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { today } from "@/lib/format";
import { apiFieldErrors, validateForm, type FieldErrors } from "@/lib/forms";
import {
  acceptFor,
  checkFile,
  describeLimits,
  uploadFile,
  UploadError,
} from "@/lib/upload";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/**
 * Registers a pet, with an optional photo. The photo is chosen before the pet
 * exists and uploaded right after it is created (an upload is signed for one
 * pet). If only the photo fails, the pet is kept and the panel offers to try
 * again.
 */
export function PetForm() {
  const create = useCreatePet();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  /** The pet was created but its photo did not upload: say so, do not leave. */
  const [photoFailed, setPhotoFailed] = useState<{
    id: string;
    name: string;
    message: string;
  } | null>(null);

  /** Null when the photo is saved, else the reason in Spanish. */
  const savePhoto = async (petId: string, file: File): Promise<string | null> => {
    setUploading(0);
    try {
      const fileId = await uploadFile(petId, "pet_photo", file, setUploading);
      const pet = await api.updatePet(petId, { photo: fileId });
      queryClient.setQueryData(keys.pet(petId), pet);
      await queryClient.invalidateQueries({ queryKey: keys.pets(), exact: true });
      return null;
    } catch (error) {
      return error instanceof UploadError ? error.message : errorMessage(error);
    } finally {
      setUploading(null);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { data, errors } = validateForm(event.currentTarget, createPetSchema, (d) => ({
      ...d,
      neutered: d.neutered === "yes",
    }));
    setErrors(errors ?? {});
    if (!data) return;
    create.mutate(data, {
      onSuccess: async (pet) => {
        const failed = photo ? await savePhoto(pet.id, photo) : null;
        if (failed) setPhotoFailed({ id: pet.id, name: pet.name, message: failed });
        else router.replace(`/mascotas/${pet.id}`);
      },
      onError: (error) => setErrors(apiFieldErrors(error)),
    });
  };

  if (photoFailed)
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-3xl bg-card p-6 shadow-sm"
      >
        <p className="font-display text-2xl leading-tight">
          El expediente de {photoFailed.name} quedó creado, pero la foto no se pudo subir.
        </p>
        <p className="text-sm text-muted-foreground">
          {photoFailed.message} Podés agregarla desde su panel.
        </p>
        <Link
          href={`/mascotas/${photoFailed.id}`}
          className={buttonVariants({ variant: "solido" })}
        >
          Ir al panel de {photoFailed.name}
        </Link>
      </div>
    );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => picker.current?.click()}
          aria-label={photo ? "Cambiar la foto" : "Agregar una foto (opcional)"}
          className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-input bg-card text-muted-foreground transition-colors outline-none hover:border-primary hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {photo ? (
            <FilePreview file={photo} className="size-full object-cover" />
          ) : (
            <Camera className="size-7" strokeWidth={1.5} aria-hidden />
          )}
        </button>
        <div className="flex min-w-0 flex-col items-start gap-1">
          <span className="text-sm">Foto (opcional)</span>
          <span className="text-xs text-muted-foreground">
            {describeLimits("pet_photo")}
          </span>
          {photo && (
            <button
              type="button"
              onClick={() => setPhoto(null)}
              className="text-xs text-primary underline underline-offset-4"
            >
              Quitar
            </button>
          )}
          {photoError && (
            <p role="alert" className="text-xs text-destructive">
              {photoError}
            </p>
          )}
        </div>
        <input
          ref={picker}
          type="file"
          accept={acceptFor("pet_photo")}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            event.target.value = "";
            if (!chosen) return;
            const problem = checkFile(chosen, "pet_photo");
            setPhotoError(problem);
            setPhoto(problem ? null : chosen);
          }}
        />
      </div>
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
          label="Esterilización"
          name="neutered"
          options={[
            { value: "no", text: "Sin esterilizar" },
            { value: "yes", text: "Esterilizado" },
          ]}
        />
        <Field label="Microchip (opcional)" name="microchip" error={errors.microchip} />
      </div>
      <FormError message={create.isError ? errorMessage(create.error) : null} />
      <Button type="submit" size="lg" disabled={create.isPending || uploading !== null}>
        {uploading !== null
          ? `Subiendo la foto… ${uploading} %`
          : create.isPending
            ? "Guardando…"
            : "Registrar mascota"}
      </Button>
    </form>
  );
}
