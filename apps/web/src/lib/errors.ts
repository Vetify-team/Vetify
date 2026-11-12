import type { ErrorCode, ErrorReason } from "@vetify/types";
import { ApiRequestError } from "./api-client";

const ASSISTANT_UNAVAILABLE_MESSAGE =
  "El asistente no está disponible en este momento. Probá de nuevo en unos minutos.";

/** The free plan's monthly allowance is used up; `limit` names it when known. */
export function assistantLimitMessage(limit: number | null): string {
  return limit === null
    ? "Usaste tus mensajes gratis de este mes."
    : `Usaste tus ${limit} ${limit === 1 ? "mensaje gratis" : "mensajes gratis"} de este mes.`;
}

/**
 * The API answers with stable English codes; this is where they become the
 * Spanish the user reads.
 */
const MESSAGES: Record<ErrorCode | "NETWORK_ERROR", string> = {
  VALIDATION_FAILED: "Revisá los datos marcados.",
  UNAUTHENTICATED: "Tu sesión terminó. Iniciá sesión de nuevo.",
  INVALID_CREDENTIALS: "Correo o contraseña incorrectos.",
  WRONG_PASSWORD: "La contraseña no es correcta.",
  SESSION_EXPIRED: "Tu sesión terminó. Iniciá sesión de nuevo.",
  FORBIDDEN: "No tenés permiso para hacer esto.",
  NOT_FOUND: "No encontramos lo que buscás.",
  IDEMPOTENCY_CONFLICT:
    "Este intento ya se usó con otros datos. Volvé a enviar el formulario.",
  EMAIL_TAKEN: "Ya existe una cuenta con ese correo.",
  LINK_CODE_INVALID:
    "El código no es válido, venció o ya se usó. Pedile uno nuevo a la clínica.",
  CLINIC_NOT_VERIFIED: "La clínica todavía no fue verificada por Vetify.",
  CLINIC_SUSPENDED:
    "La clínica está suspendida. Escribinos a Vetify para más información.",
  NOT_CLINIC_MEMBER: "Ya no formás parte del equipo de ninguna clínica.",
  SIGNUP_LINK_INVALID:
    "El enlace de registro no es válido, venció o ya se usó. Escribinos para recibir uno nuevo.",
  INVITATION_INVALID:
    "La invitación no es válida, venció o ya se usó. Pedile una nueva a la clínica.",
  INVALID_ORIGIN: "La solicitud no vino de la app de Vetify.",
  API_VERSION_UNSUPPORTED: "La app está desactualizada. Recargá la página.",
  PAYLOAD_TOO_LARGE: "Los datos son demasiado grandes.",
  RATE_LIMITED: "Demasiados intentos. Esperá un minuto.",
  BILLING_UNAVAILABLE:
    "Los pagos no están disponibles en este momento. Intentá más tarde.",
  RESET_TOKEN_INVALID: "El enlace no es válido, venció o ya se usó. Pedí uno nuevo.",
  UPLOADS_UNAVAILABLE:
    "La carga de archivos no está disponible en este momento. Intentá más tarde.",
  MAIL_UNAVAILABLE: "No pudimos enviar el correo. Intentá de nuevo en un rato.",
  ASSISTANT_UNAVAILABLE: ASSISTANT_UNAVAILABLE_MESSAGE,
  BAD_REQUEST: "La solicitud no es válida.",
  INTERNAL_ERROR: "Algo salió mal. Intentá de nuevo.",
  NETWORK_ERROR: "No pudimos conectar con el servidor. Revisá tu conexión.",
};

/** Business rules (and assistant limits) an error names in its stable `reason`. */
const REASONS: Record<ErrorReason, string> = {
  EXPIRY_BEFORE_APPLIED: "El vencimiento no puede ser anterior a la aplicación.",
  NEXT_DOSE_BEFORE_APPLIED: "La próxima dosis no puede ser anterior a la aplicación.",
  CONSULTATION_NOT_IN_PET: "La consulta no es de esta mascota.",
  END_BEFORE_START: "El fin no puede ser anterior al inicio.",
  PLAN_LIMIT:
    "El plan gratuito permite hasta 2 mascotas. Pasate a Premium para agregar más.",
  FILE_TOO_LARGE: "El archivo es demasiado grande.",
  FILE_TYPE_NOT_ALLOWED: "Ese tipo de archivo no se permite.",
  FILE_NOT_UPLOADED: "El archivo no terminó de subirse. Subilo de nuevo.",
  ASSISTANT_DISABLED: "El asistente no está activado en este servidor.",
  ASSISTANT_UNAVAILABLE: ASSISTANT_UNAVAILABLE_MESSAGE,
  ASSISTANT_LIMIT: assistantLimitMessage(null),
};

/** An assistant error as the chat shows it. */
export interface AssistantError {
  message: string;
  /** Offer the Premium plan: the free allowance is used up. */
  upgrade: boolean;
  /** Sending the same question again may work (unavailable, rate, network). */
  retry: boolean;
}

/** Maps an error of `api.assistant.send` to what the chat shows. */
export function assistantError(error: unknown, limit: number | null): AssistantError {
  if (error instanceof ApiRequestError) {
    if (error.reason === "ASSISTANT_LIMIT")
      return { message: assistantLimitMessage(limit), upgrade: true, retry: false };
    if (error.reason === "ASSISTANT_DISABLED")
      return { message: REASONS.ASSISTANT_DISABLED, upgrade: false, retry: false };
    if (error.code === "ASSISTANT_UNAVAILABLE")
      return { message: ASSISTANT_UNAVAILABLE_MESSAGE, upgrade: false, retry: true };
    if (error.code === "RATE_LIMITED")
      return {
        message: "Mandaste muchas preguntas seguidas. Esperá un minuto y probá de nuevo.",
        upgrade: false,
        retry: true,
      };
    if (error.code === "NETWORK_ERROR")
      return { message: MESSAGES.NETWORK_ERROR, upgrade: false, retry: true };
  }
  return { message: errorMessage(error), upgrade: false, retry: false };
}

/** Message to show the user for any error thrown by the API client. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return (error.reason && REASONS[error.reason]) || MESSAGES[error.code];
  }
  return MESSAGES.INTERNAL_ERROR;
}
