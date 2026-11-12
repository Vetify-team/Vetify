"use client";

import type { UploadPurpose } from "@vetify/types";
import { FileText, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { acceptFor, describeLimits, uploadFile, UploadError } from "@/lib/upload";

export type UploadState =
  | { status: "idle" }
  | { status: "uploading"; progress: number }
  | { status: "done"; fileId: string }
  | { status: "error"; message: string };

/**
 * Picks a file, shows a preview and the upload progress, and uploads it as
 * soon as it is chosen. `onChange` reports each state; a form saves the
 * `fileId` of a finished upload.
 */
export function useFileUpload(petId: string, purpose: UploadPurpose) {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [file, setFile] = useState<File | null>(null);
  const attempt = useRef(0);

  /** Uploads `chosen`; `onDone` gets the file id unless a newer upload started. */
  const start = useCallback(
    (chosen: File, onDone?: (fileId: string) => void) => {
      const current = ++attempt.current;
      setFile(chosen);
      setState({ status: "uploading", progress: 0 });
      uploadFile(petId, purpose, chosen, (progress) => {
        if (current === attempt.current) setState({ status: "uploading", progress });
      }).then(
        (fileId) => {
          if (current !== attempt.current) return;
          setState({ status: "done", fileId });
          onDone?.(fileId);
        },
        (error: unknown) => {
          if (current !== attempt.current) return;
          setState({
            status: "error",
            message:
              error instanceof UploadError
                ? error.message
                : "No se pudo subir el archivo. Intentá de nuevo.",
          });
        },
      );
    },
    [petId, purpose],
  );

  const clear = useCallback(() => {
    attempt.current++;
    setFile(null);
    setState({ status: "idle" });
  }, []);

  return { state, file, start, clear };
}

/** Preview of a chosen file: the image itself, or an icon with the name. */
export function FilePreview({ file, className }: { file: File; className?: string }) {
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  useEffect(() => {
    // Browsers cannot show HEIC; those get the icon.
    if (!file.type.startsWith("image/") || file.type === "image/heic") return;
    const reader = new FileReader();
    reader.onload = () => setPreview({ file, url: reader.result as string });
    reader.readAsDataURL(file);
    return () => reader.abort();
  }, [file]);
  const url = preview?.file === file ? preview.url : null;

  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- local file preview
    <img src={url} alt="Vista previa" className={className ?? "size-16 object-cover"} />
  ) : (
    <span className="flex size-16 shrink-0 items-center justify-center border border-border bg-muted">
      <FileText className="size-6 text-muted-foreground" aria-hidden />
    </span>
  );
}

export function UploadProgress({ state }: { state: UploadState }) {
  if (state.status === "uploading")
    return (
      <Progress value={state.progress} aria-label="Progreso de la subida">
        <span className="text-xs text-muted-foreground">
          Subiendo… {state.progress} %
        </span>
      </Progress>
    );
  if (state.status === "error")
    return (
      <p role="alert" className="text-xs text-destructive">
        {state.message}
      </p>
    );
  if (state.status === "done")
    return (
      <p role="status" className="text-xs text-muted-foreground">
        ✓ Archivo listo
      </p>
    );
  return null;
}

/**
 * File field for a form: uploads on choice and puts the resulting id in a
 * hidden input named `name`. `onStatusChange` lets the form wait for an
 * upload in progress and refuse to save while a chosen file failed.
 */
export function FileUploadField({
  petId,
  purpose,
  label,
  name,
  error,
  onStatusChange,
}: {
  petId: string;
  purpose: UploadPurpose;
  label: string;
  name: string;
  error?: string;
  onStatusChange?: (status: UploadState["status"]) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const { state, file, start, clear } = useFileUpload(petId, purpose);
  useEffect(() => onStatusChange?.(state.status), [state.status, onStatusChange]);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
      </label>
      <input
        ref={input}
        id={id}
        type="file"
        accept={acceptFor(purpose)}
        className="sr-only"
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          if (chosen) start(chosen);
          event.target.value = "";
        }}
      />
      <input
        type="hidden"
        name={name}
        value={state.status === "done" ? state.fileId : ""}
      />
      {file ? (
        <div className="flex items-center gap-3">
          <FilePreview file={file} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <p className="truncate text-sm">{file.name}</p>
            <UploadProgress state={state} />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Quitar archivo"
            onClick={clear}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() => input.current?.click()}
        >
          Elegir archivo
        </Button>
      )}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">{describeLimits(purpose)}</p>
      )}
    </div>
  );
}
