import { UPLOAD_LIMITS, type UploadPurpose } from "@vetify/types";
import { api } from "./api-client";
import { errorMessage } from "./errors";

const megabytes = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

/** What the file picker offers for each purpose. */
export const acceptFor = (purpose: UploadPurpose) =>
  Object.keys(UPLOAD_LIMITS[purpose].contentTypes).join(",");

/** Spanish description of the allowed files, for hints. */
export function describeLimits(purpose: UploadPurpose): string {
  const kinds =
    purpose === "pet_photo" ? "JPG, PNG, WEBP o HEIC" : "PDF, JPG, PNG, WEBP o HEIC";
  return `${kinds}, hasta ${megabytes(UPLOAD_LIMITS[purpose].maxBytes)}`;
}

/**
 * The same limits the API applies, checked before asking for a signature so
 * the user hears about them at once. The API and the storage service check
 * again: this is only for the message.
 */
export function checkFile(file: File, purpose: UploadPurpose): string | null {
  const limits = UPLOAD_LIMITS[purpose];
  if (!Object.hasOwn(limits.contentTypes, file.type))
    return `Ese tipo de archivo no se permite. Usá ${describeLimits(purpose)}.`;
  if (file.size > limits.maxBytes)
    return `El archivo pesa más de ${megabytes(limits.maxBytes)}.`;
  if (file.size === 0) return "El archivo está vacío.";
  return null;
}

export class UploadError extends Error {}

/**
 * Uploads a file straight to the storage service with a signature from the
 * API, reporting progress from 0 to 100. Resolves with the file id to send
 * when saving the photo or exam. Errors carry a Spanish message.
 */
export async function uploadFile(
  petId: string,
  purpose: UploadPurpose,
  file: File,
  onProgress: (percent: number) => void,
): Promise<string> {
  const problem = checkFile(file, purpose);
  if (problem) throw new UploadError(problem);

  let ticket;
  try {
    ticket = await api.requestUpload(petId, {
      purpose,
      contentType: file.type,
      size: file.size,
    });
  } catch (error) {
    throw new UploadError(errorMessage(error));
  }

  const form = new FormData();
  for (const [key, value] of Object.entries(ticket.fields)) form.append(key, value);
  form.append("file", file);

  // XMLHttpRequest, not fetch: fetch cannot report upload progress.
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", ticket.url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      // The service names a rejected format in its English message.
      const text = xhr.responseText.toLowerCase();
      reject(
        new UploadError(
          text.includes("format")
            ? `Ese tipo de archivo no se permite. Usá ${describeLimits(purpose)}.`
            : text.includes("too large") || text.includes("file size")
              ? "El archivo es demasiado grande."
              : "No se pudo subir el archivo. Intentá de nuevo.",
        ),
      );
    };
    xhr.onerror = () =>
      reject(new UploadError("No se pudo subir el archivo. Revisá tu conexión."));
    xhr.send(form);
  });
  onProgress(100);
  return ticket.fileId;
}
