import type { z } from "zod";
import { ApiRequestError } from "./api-client";

export type FieldErrors = Record<string, string>;
type Issue = z.core.$ZodIssue;

/** Field-specific wording for format and rule errors. */
const FIELD_MESSAGES: Record<string, string> = {
  email: "Correo electrónico inválido",
  photoUrl: "Debe ser un enlace https",
  fileUrl: "Debe ser un enlace https",
  microchip: "Solo letras, números, espacios y guiones",
  code: "El código tiene 8 letras o números, como K7PQ-4MXA",
  clinicName: "El nombre de la clínica es obligatorio",
};

/**
 * The shared schemas speak English (they also validate the API); the user
 * reads Spanish. Each issue is translated by its kind, not by its text.
 */
export function issueToSpanish(issue: Issue): string {
  const field = String(issue.path.at(-1) ?? "");

  switch (issue.code) {
    case "invalid_type":
      return issue.message.includes("received undefined")
        ? "Este campo es obligatorio"
        : "Valor inválido";
    case "too_small":
      if (issue.origin === "string") {
        return Number(issue.minimum) <= 1
          ? "Este campo es obligatorio"
          : `Debe tener al menos ${issue.minimum} caracteres`;
      }
      return Number(issue.minimum) === 0
        ? "Debe ser mayor que cero"
        : `Debe ser al menos ${issue.minimum}`;
    case "too_big":
      return issue.origin === "string"
        ? `Máximo ${issue.maximum} caracteres`
        : `Debe ser como máximo ${issue.maximum}`;
    case "invalid_format":
      if (issue.format === "date") return "Fecha inválida";
      return FIELD_MESSAGES[field] ?? "Contiene caracteres no permitidos";
    case "invalid_value":
      return "Elegí una opción válida";
    case "custom":
      if (issue.message.startsWith("Date must be"))
        return "La fecha está fuera del rango permitido";
      if (issue.message.includes("future")) return "La fecha no puede ser futura";
      return FIELD_MESSAGES[field] ?? "Revisá este campo";
    default:
      return FIELD_MESSAGES[field] ?? "Revisá este campo";
  }
}

/**
 * Reads a <form> and validates it with the same Zod schema the API uses.
 * Empty fields are omitted so optional ones stay `undefined`.
 */
export function validateForm<T>(
  form: HTMLFormElement,
  schema: z.ZodType<T>,
  transform: (data: Record<string, unknown>) => Record<string, unknown> = (d) => d,
): { data: T; errors: null } | { data: null; errors: FieldErrors } {
  const raw: Record<string, unknown> = {};
  new FormData(form).forEach((value, field) => {
    if (typeof value === "string" && value.trim() !== "") raw[field] = value.trim();
  });

  const result = schema.safeParse(transform(raw));
  if (result.success) return { data: result.data, errors: null };

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path.map(String).join(".") || "_";
    errors[field] ??= issueToSpanish(issue);
  }
  return { data: null, errors };
}

/**
 * Field errors returned by the API (400 VALIDATION_FAILED). The client
 * validates first, so these are rare; the API's English text is not shown.
 */
export function apiFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ApiRequestError) || !error.errors) return {};
  return Object.fromEntries(
    error.errors.map((e) => [e.field, FIELD_MESSAGES[e.field] ?? "Revisá este campo"]),
  );
}
