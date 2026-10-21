import type { Alert, Pet } from "@vetify/types";
import { age, speciesLabel } from "@/lib/format";

/** "Golden Retriever · 4 años", or "Perro · 4 años" without a breed. */
export const describePet = (pet: Pet): string =>
  [pet.breed ?? speciesLabel[pet.species], age(pet.birthDate)]
    .filter(Boolean)
    .join(" · ");

/** "LUNA · GOLDEN RETRIEVER": label of a pet's screens. */
export const petLabel = (pet: Pet): string =>
  `${pet.name} · ${pet.breed ?? speciesLabel[pet.species]}`;

/** One-line status of a pet from its alerts. */
export function summarizeAlerts(alerts: Alert[]): { text: string; action: boolean } {
  const expired = alerts.filter((a) => a.status === "expired").length;
  const due = alerts.filter((a) => a.status === "due").length;
  const expiring = alerts.filter((a) => a.status === "expiring").length;
  if (expired)
    return {
      text: expired === 1 ? "1 dosis vencida" : `${expired} dosis vencidas`,
      action: true,
    };
  if (due) return { text: due === 1 ? "1 pendiente" : `${due} pendientes`, action: true };
  if (expiring) return { text: "Por vencer", action: true };
  return { text: "Al día", action: false };
}
