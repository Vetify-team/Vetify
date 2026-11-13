"use client";

import type { Pet } from "@vetify/types";
import { useRef, useState } from "react";
import { FilePreview, UploadProgress, useFileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { useUpdatePet } from "@/hooks/usePets";
import { errorMessage } from "@/lib/errors";
import { acceptFor, describeLimits } from "@/lib/upload";
import { cn } from "cn";
import { avatarTone } from "./pet-utils";

export type AvatarSize = "sm" | "md" | "lg" | "xl";

const SIZES: Record<AvatarSize, { box: string; text: string }> = {
  sm: { box: "size-10 rounded-full", text: "text-xl" },
  md: { box: "size-14 rounded-full", text: "text-3xl" },
  lg: { box: "size-24 rounded-3xl", text: "text-5xl" },
  xl: { box: "size-32 rounded-[2rem] sm:size-40", text: "text-7xl" },
};

/**
 * The pet's photo, or its initial on a warm color picked from its name when
 * there is no photo or it fails to load.
 */
export function PetAvatar({
  pet,
  size = "md",
  className,
}: {
  pet: Pet;
  size?: AvatarSize;
  className?: string;
}) {
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const { box, text } = SIZES[size];
  return pet.photoUrl && brokenUrl !== pet.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- signed URL, already sized
    <img
      src={pet.photoUrl}
      alt={`Foto de ${pet.name}`}
      className={cn(box, "shrink-0 object-cover", className)}
      onError={() => setBrokenUrl(pet.photoUrl)}
    />
  ) : (
    <span
      aria-hidden
      className={cn(
        box,
        avatarTone(pet.name),
        "flex shrink-0 items-center justify-center font-display",
        text,
        className,
      )}
    >
      {pet.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** The pet's photo on its profile. Owners can upload, replace or remove it where `editable`. */
export function PetPhoto({
  pet,
  editable,
  size = "lg",
}: {
  pet: Pet;
  editable?: boolean;
  size?: AvatarSize;
}) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useFileUpload(pet.id, "pet_photo");
  const update = useUpdatePet(pet.id);
  const { state } = upload;

  const busy = state.status === "uploading" || update.isPending;
  const image =
    upload.file && state.status !== "error" ? (
      <FilePreview
        file={upload.file}
        className={cn(SIZES[size].box, "shrink-0 object-cover")}
      />
    ) : (
      <PetAvatar pet={pet} size={size} />
    );

  if (!editable) return image;

  return (
    <div className="flex flex-col items-center gap-2">
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
      <div className="w-40 text-center">
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
