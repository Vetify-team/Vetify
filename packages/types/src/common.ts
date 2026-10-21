import { z } from "zod";

/** Identifier of any entity. */
export const idSchema = z.uuid();
export type Id = z.infer<typeof idSchema>;

const DAY_MS = 86_400_000;

/** Oldest date the app accepts (birth dates, historical records). */
export const MIN_DATE = "1990-01-01";
/** How far into the future an expiry or next dose can be scheduled. */
export const MAX_FUTURE_YEARS = 10;

const isoDate = z.iso.date({ error: "Invalid date (expected YYYY-MM-DD)" });

/**
 * "Today" is evaluated with one day of tolerance so a user in Costa Rica
 * (UTC-6) is never rejected near midnight UTC.
 */
const todayPlusOne = () => new Date(Date.now() + DAY_MS).toISOString().slice(0, 10);

/** Any calendar date (`date` columns): YYYY-MM-DD. Used in responses. */
export const dateSchema = isoDate;
export type IsoDate = z.infer<typeof dateSchema>;

/** A date that already happened: birth, application, measurement. */
export const pastDateSchema = isoDate.refine(
  (value) => value >= MIN_DATE && value <= todayPlusOne(),
  { error: `Date must be between ${MIN_DATE} and today` },
);

/** A date that may be in the future: expiry, next dose. */
export const scheduleDateSchema = isoDate.refine(
  (value) => {
    const limit = new Date();
    limit.setUTCFullYear(limit.getUTCFullYear() + MAX_FUTURE_YEARS);
    return value >= MIN_DATE && value <= limit.toISOString().slice(0, 10);
  },
  { error: `Date must be between ${MIN_DATE} and ${MAX_FUTURE_YEARS} years from now` },
);

/** Full timestamp (`timestamptz` columns). */
export const dateTimeSchema = z.iso.datetime({ offset: true });
export type IsoDateTime = z.infer<typeof dateTimeSchema>;

// Control characters let a value smuggle structure into other formats
// (e.g. iCalendar lines), so free text rejects them. Multiline text keeps \n.
// eslint-disable-next-line no-control-regex
const SINGLE_LINE = /^[^\u0000-\u001f\u007f]*$/;
// eslint-disable-next-line no-control-regex
const MULTI_LINE = /^[^\u0000-\u0009\u000b-\u001f\u007f]*$/;

/** Free text on one line, trimmed, without control characters. */
export const textSchema = (max: number) =>
  z.string().trim().max(max).regex(SINGLE_LINE, { error: "Contains invalid characters" });

/** Free text that may span lines (notes, diagnosis). */
export const multilineTextSchema = (max: number) =>
  z.string().trim().max(max).regex(MULTI_LINE, { error: "Contains invalid characters" });

/**
 * External link (photo, exam file). Only https and a real domain: rejects
 * `javascript:`, `data:`, plain http and raw IPs such as cloud metadata hosts.
 */
export const httpsUrlSchema = z
  .url({
    protocol: /^https$/,
    hostname: z.regexes.domain,
    error: "Must be an https link",
  })
  .max(2048);

/** Cursor pagination for list endpoints. */
export const pageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().max(200).optional(),
});
export type PageQuery = z.infer<typeof pageQuerySchema>;

/** A page of results; `nextCursor` is null on the last page. */
export const pageSchema = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable() });
export type Page<T> = { items: T[]; nextCursor: string | null };

/**
 * Stable machine-readable error codes. Clients translate these to the user's
 * language; `message` is an English description for developers.
 */
export const errorCodeSchema = z.enum([
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "INVALID_CREDENTIALS",
  "SESSION_EXPIRED",
  "FORBIDDEN",
  "NOT_FOUND",
  "EMAIL_TAKEN",
  "IDEMPOTENCY_CONFLICT",
  "LINK_CODE_INVALID",
  "CLINIC_NOT_VERIFIED",
  "INVALID_ORIGIN",
  "API_VERSION_UNSUPPORTED",
  "PAYLOAD_TOO_LARGE",
  "RATE_LIMITED",
  "BAD_REQUEST",
  "INTERNAL_ERROR",
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

/** Shape of every error response of the API. */
export const apiErrorSchema = z.object({
  code: errorCodeSchema,
  message: z.string(),
  /** Present on VALIDATION_FAILED: one message per invalid field. */
  errors: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
