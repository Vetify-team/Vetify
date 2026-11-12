import type { ErrorCode, ErrorReason } from "@vetify/types";
import { ApiRequestError } from "./api-client";

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
  BAD_REQUEST: "La solicitud no es válida.",
  INTERNAL_ERROR: "Algo salió mal. Intentá de nuevo.",
  NETWORK_ERROR: "No pudimos conectar con el servidor. Revisá tu conexión.",
};

/** Business rules a BAD_REQUEST names in its stable `reason`. */
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
};

/** Message to show the user for any error thrown by the API client. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return (error.reason && REASONS[error.reason]) || MESSAGES[error.code];
  }
  return MESSAGES.INTERNAL_ERROR;
}
