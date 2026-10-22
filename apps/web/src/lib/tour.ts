import type { SignUpRole } from "@vetify/types";

/**
 * The first-run guided tour: when it runs and what it shows. Pure logic; the
 * component in components/tour drives it.
 *
 * The tour runs only after signing up (or when asked again from Ajustes): the
 * wizard leaves a mark in localStorage, cleared once the user starts or
 * dismisses the tour. Only that flag is stored, never personal or health data.
 * Components read it as an external store (`subscribeTourPending`).
 */

export type TourTarget =
  | "pet-list"
  | "pet-empty"
  | "add-pet"
  | "nav-carne"
  | "nav-avisos"
  | "nav-ajustes"
  | "clinic-status"
  | "nav-pacientes"
  | "nav-codigo"
  | "nav-vencidos";

export interface TourStep {
  target: TourTarget;
  title: string;
  text: string;
}

export const tourPendingKey = (userId: string) => `vetify:tour-pending:${userId}`;

/** Storage may be missing or blocked (private mode): the tour is then skipped. */
function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

const CHANGE_EVENT = "vetify:tour-pending";

function write(change: (store: Storage) => void): void {
  try {
    const store = storage();
    if (!store) return;
    change(store);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Quota or privacy settings: no tour, nothing else breaks.
  }
}

export function markTourPending(userId: string): void {
  write((store) => store.setItem(tourPendingKey(userId), "1"));
}

export function clearTourPending(userId: string): void {
  write((store) => store.removeItem(tourPendingKey(userId)));
}

export function isTourPending(userId: string): boolean {
  try {
    return storage()?.getItem(tourPendingKey(userId)) === "1";
  } catch {
    return false;
  }
}

/** For useSyncExternalStore: this tab's changes and other tabs' (storage event). */
export function subscribeTourPending(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export const requestTourReplay = markTourPending;

export function tourSteps(
  role: SignUpRole,
  context: { petName: string | null },
): TourStep[] {
  if (role === "clinic") {
    return [
      {
        target: "clinic-status",
        title: "Tu clínica",
        text: "Mientras la verificamos podés explorar el portal. Te avisamos por correo cuando esté lista.",
      },
      {
        target: "nav-pacientes",
        title: "Pacientes",
        text: "Acá aparecen las mascotas cuyos dueños te dieron permiso.",
      },
      {
        target: "nav-vencidos",
        title: "Esquemas vencidos",
        text: "Pacientes con vacunas atrasadas, listos para que los contactés.",
      },
      {
        target: "nav-codigo",
        title: "Código de vinculación",
        text: "Generá un código y mostráselo al dueño en la consulta: lo escribe en su app y te da acceso al expediente.",
      },
    ];
  }
  return [
    context.petName
      ? {
          target: "pet-list",
          title: `El expediente de ${context.petName}`,
          text: "Tocalo para ver sus vacunas, consultas y controles de peso.",
        }
      : {
          target: "pet-empty",
          title: "Tu primera mascota",
          text: "Empezá su expediente desde acá cuando quieras.",
        },
    {
      target: "add-pet",
      title: "Agregá más mascotas",
      text: "Registrá a cada una con su propio expediente.",
    },
    {
      target: "nav-carne",
      title: "Carné digital",
      text: "Mostrá su QR en hospedajes, guarderías o viajes: se verifica al instante.",
    },
    {
      target: "nav-avisos",
      title: "Avisos",
      text: "Te avisamos antes de que venza una vacuna o desparasitación.",
    },
    {
      target: "nav-ajustes",
      title: "Ajustes",
      text: "Tu cuenta, el tema de la app y este recorrido, por si querés verlo de nuevo.",
    },
  ];
}
