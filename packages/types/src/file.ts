import { z } from "zod";
import { dateTimeSchema } from "./common.js";

/**
 * Files uploaded by the browser straight to the storage service (Cloudinary)
 * with a signature the API issues for one pet and one purpose.
 */
export const uploadPurposeSchema = z.enum(["pet_photo", "exam_file"]);
export type UploadPurpose = z.infer<typeof uploadPurposeSchema>;

const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
} as const;

/**
 * What each purpose accepts. `formats` are the storage service's names for
 * the detected file format: it rejects any other at upload, and the API checks
 * them again with the size before saving the file to the record.
 */
export const UPLOAD_LIMITS = {
  pet_photo: {
    maxBytes: 5 * 1024 * 1024,
    contentTypes: IMAGE_TYPES,
  },
  exam_file: {
    maxBytes: 10 * 1024 * 1024,
    contentTypes: { "application/pdf": "pdf", ...IMAGE_TYPES },
  },
} as const satisfies Record<
  UploadPurpose,
  { maxBytes: number; contentTypes: Record<string, string> }
>;

export const allowedFormats = (purpose: UploadPurpose): string[] =>
  Object.values(UPLOAD_LIMITS[purpose].contentTypes);

export const createUploadSchema = z.object({
  purpose: uploadPurposeSchema,
  contentType: z.string().max(100),
  size: z.number().int().positive(),
});
export type CreateUpload = z.infer<typeof createUploadSchema>;

/** A signed upload: the browser POSTs `fields` plus `file` to `url`. */
export const uploadTicketSchema = z.object({
  url: z.string(),
  fields: z.record(z.string(), z.string()),
  /** The id to send back when saving the record (photo or exam). */
  fileId: z.string(),
  maxBytes: z.number().int(),
  expiresAt: dateTimeSchema,
});
export type UploadTicket = z.infer<typeof uploadTicketSchema>;

/**
 * Id of an uploaded file. It names the pet and the purpose, so a file
 * uploaded for one pet cannot be saved to another.
 */
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const FILE_FOLDERS = { pet_photo: "photo", exam_file: "exams" } as const;
export const fileIdSchema = z
  .string()
  .regex(new RegExp(`^pets/${uuid}/(photo|exams)/${uuid}$`), {
    error: "Invalid file",
  });

/** Short-lived link to read a private file. */
export const fileLinkSchema = z.object({
  url: z.string(),
  expiresAt: dateTimeSchema,
});
export type FileLink = z.infer<typeof fileLinkSchema>;
