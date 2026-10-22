import type {
  Alert,
  AnimalSex,
  DewormingKind,
  PermissionScope,
  Species,
} from "@vetify/types";

/** Display copy in Costa Rican Spanish for values the API sends as codes. */

export const speciesLabel: Record<Species, string> = {
  dog: "Perro",
  cat: "Gato",
  other: "Otra especie",
};

export const dewormingKindLabel: Record<DewormingKind, string> = {
  internal: "Interna",
  external: "Externa",
};

/** Legacy records may carry a free-text kind; those read as a plain deworming. */
export const dewormingLabel = (kind: string | null): string =>
  kind && kind in dewormingKindLabel
    ? `Desparasitación ${dewormingKindLabel[kind as DewormingKind].toLowerCase()}`
    : "Desparasitación";

/** Vaccine name, or the deworming kind in words. */
export const alertLabel = (alert: Pick<Alert, "kind" | "name">): string =>
  alert.kind === "deworming" ? dewormingLabel(alert.name) : alert.name;

export const scopeLabel: Record<PermissionScope, string> = {
  full: "Puede ver y escribir",
  card_only: "Solo carné verificable",
};

const ACCESS_ACTIONS: Record<string, string> = {
  view_record: "Consulta del expediente",
  view_vaccination: "Consulta del esquema",
  view_pet: "Consulta del perfil",
  view_alerts: "Revisión de esquemas vencidos",
  list_patients: "Listado de pacientes",
  access_denied: "Intento de acceso sin permiso",
  record_consultation: "Registro de consulta",
  record_vaccination: "Registro de vacuna",
  record_deworming: "Registro de desparasitación",
  record_treatment: "Registro de tratamiento",
  record_exam: "Registro de examen",
  record_weight: "Registro de peso",
  record_feeding: "Observación del día a día",
  grant_permission: "Acceso otorgado",
  revoke_permission: "Acceso revocado",
  restore_permission: "Acceso restablecido",
  view_permissions: "Revisión de permisos",
  view_access_log: "Revisión de la bitácora",
  update_pet: "Edición del perfil",
};

/** Access-log action in words; unknown (newer) actions show their code. */
export const accessActionLabel = (action: string): string =>
  ACCESS_ACTIONS[action] ?? action;

export const sexLabel: Record<AnimalSex, string> = {
  female: "Hembra",
  male: "Macho",
};
