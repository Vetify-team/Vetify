"use client";

import type { Pet } from "@vetify/types";
import { useRef, useState } from "react";
import { FilePreview, UploadProgress, useFileUpload } from "@/components/file-upload";
import { Initial } from "@/components/system";
import { Button } from "@/components/ui/button";
import { useUpdatePet } from "@/hooks/usePets";
import { errorMessage } from "@/lib/errors";
import { acceptFor, describeLimits } from "@/lib/upload";

const frame = "size-20 shrink-0 border border-border object-cover";

/** The pet's photo, or its initial. Owners can upload, replace or remove it. */
export function PetPhoto({ pet, editable }: { pet: Pet; editable?: boolean }) {
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const upload = useFileUpload(pet.id, "pet_photo");
  const update = useUpdatePet(pet.id);
  const { state } = upload;

  const busy = state.status === "uploading" || update.isPending;
  const image =
    upload.file && state.status !== "error" ? (
      <FilePreview file={upload.file} className={frame} />
    ) : pet.photoUrl && brokenUrl !== pet.photoUrl ? (
      // eslint-disable-next-line @next/next/no-img-element -- signed URL, already sized
      <img
        src={pet.photoUrl}
        alt={`Foto de ${pet.name}`}
        className={frame}
        onError={() => setBrokenUrl(pet.photoUrl)}
      />
    ) : (
      <Initial name={pet.name} large />
    );

  if (!editable) return image;

  return (
    <div className="flex flex-col items-start gap-2">
      {image}
      <input
        ref={input}
        type="file"
        accept={acceptFor("pet_photo")}
        aria-label="Elegir foto"
        className="sr-only"
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          if (chosen) {
            update.reset();
            // Saved as soon as the upload finishes; the API checks the file again.
            upload.start(chosen, (photo) =>
              update.mutate({ photo }, { onSettled: upload.clear }),
            );
          }
          event.target.value = "";
        }}
      />
      <div className="flex gap-1">
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={busy}
          title={describeLimits("pet_photo")}
          onClick={() => input.current?.click()}
        >
          {pet.photoUrl ? "Cambiar foto" : "Agregar foto"}
        </Button>
        {pet.photoUrl && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={busy}
            onClick={() => update.mutate({ photo: null })}
          >
            Quitar
          </Button>
        )}
      </div>
      <div className="w-40">
        {update.isPending ? (
          <p role="status" className="text-xs text-muted-foreground">
            Guardando…
          </p>
        ) : update.isError ? (
          <p role="alert" className="text-xs text-destructive">
            {errorMessage(update.error)}
          </p>
        ) : (
          <UploadProgress state={state.status === "done" ? { status: "idle" } : state} />
        )}
      </div>
    </div>
  );
}
