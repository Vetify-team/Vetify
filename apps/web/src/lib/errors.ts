import type { ErrorCode } from "@vetify/types";
import { ApiRequestError } from "./api-client";

/**
 * The API answers with stable English codes; this is where they become the
 * Spanish the user reads.
 */
const MESSAGES: Record<ErrorCode | "NETWORK_ERROR", string> = {
  VALIDATION_FAILED: "Revisá los datos marcados.",
  UNAUTHENTICATED: "Tu sesión terminó. Iniciá sesión de nuevo.",
  INVALID_CREDENTIALS: "Correo o contraseña incorrectos.",
  SESSION_EXPIRED: "Tu sesión terminó. Iniciá sesión de nuevo.",
  FORBIDDEN: "No tenés permiso para hacer esto.",
  NOT_FOUND: "No encontramos lo que buscás.",
  IDEMPOTENCY_CONFLICT:
    "Este intento ya se usó con otros datos. Volvé a enviar el formulario.",
  EMAIL_TAKEN: "Ya existe una cuenta con ese correo.",
  LINK_CODE_INVALID:
    "El código no es válido, venció o ya se usó. Pedile uno nuevo a la clínica.",
  CLINIC_NOT_VERIFIED: "La clínica todavía no fue verificada por Vetify.",
  INVALID_ORIGIN: "La solicitud no vino de la app de Vetify.",
  API_VERSION_UNSUPPORTED: "La app está desactualizada. Recargá la página.",
  PAYLOAD_TOO_LARGE: "Los datos son demasiado grandes.",
  RATE_LIMITED: "Demasiados intentos. Esperá un minuto.",
  BAD_REQUEST: "La solicitud no es válida.",
  INTERNAL_ERROR: "Algo salió mal. Intentá de nuevo.",
  NETWORK_ERROR: "No pudimos conectar con el servidor. Revisá tu conexión.",
};

/**
 * Business-rule messages that come as BAD_REQUEST with a specific English
 * message; translated when known.
 */
const BAD_REQUEST_DETAIL: Record<string, string> = {
  "Expiry cannot be before the application date":
    "El vencimiento no puede ser anterior a la aplicación.",
  "The next dose cannot be before the application date":
    "La próxima dosis no puede ser anterior a la aplicación.",
  "The consultation does not belong to this pet": "La consulta no es de esta mascota.",
  "The end cannot be before the start": "El fin no puede ser anterior al inicio.",
};

/** Message to show the user for any error thrown by the API client. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return (
      (error.code === "BAD_REQUEST" && BAD_REQUEST_DETAIL[error.message]) ||
      MESSAGES[error.code]
    );
  }
  return MESSAGES.INTERNAL_ERROR;
}
