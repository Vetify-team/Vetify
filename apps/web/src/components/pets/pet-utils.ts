import type { Alert, Pet } from "@vetify/types";
import { age } from "@/lib/format";
import { speciesLabel } from "@/lib/labels";

/** "Golden Retriever · 4 años", or "Perro · 4 años" without a breed. */
export const describePet = (pet: Pet): string =>
  [pet.breed ?? speciesLabel[pet.species], age(pet.birthDate)]
    .filter(Boolean)
    .join(" · ");

/** "LUNA · GOLDEN RETRIEVER": label of a pet's screens. */
export const petLabel = (pet: Pet): string =>
  `${pet.name} · ${pet.breed ?? speciesLabel[pet.species]}`;

/**
 * One-line status of a pet from its alerts. Alerts come only from recorded
 * doses, so none means nothing recorded yet: not "Al día".
 */
export function summarizeAlerts(alerts: Alert[]): { text: string; action: boolean } {
  if (!alerts.length) return { text: "Sin registros", action: false };
  const expired = alerts.filter((a) => a.status === "expired").length;
  const expiring = alerts.filter((a) => a.status === "expiring").length;
  if (expired)
    return {
      text: expired === 1 ? "1 dosis vencida" : `${expired} dosis vencidas`,
      action: true,
    };
  if (expiring) return { text: "Por vencer", action: true };
  return { text: "Al día", action: false };
}

/** Warm tones for a pet without a photo; text keeps AA contrast on each. */
const TONES = [
  "bg-[#ecd9b4] text-[#6b4a12] dark:bg-[#4a3a1f] dark:text-[#f0d9a8]",
  "bg-[#d9e2cb] text-[#3d4d27] dark:bg-[#33402a] dark:text-[#d4e2bd]",
  "bg-[#f0d2c4] text-[#7a3522] dark:bg-[#4d2c22] dark:text-[#f2c8b7]",
  "bg-[#d4dfe4] text-[#2e4854] dark:bg-[#26363e] dark:text-[#c7dbe4]",
  "bg-[#e6d5e0] text-[#5b3150] dark:bg-[#3e2b39] dark:text-[#e8cde0]",
] as const;

/** The same tone for the same name, everywhere. */
export function avatarTone(name: string): string {
  let hash = 0;
  for (const char of name.trim().toLowerCase())
    hash = (hash * 31 + char.codePointAt(0)!) | 0;
  return TONES[Math.abs(hash) % TONES.length]!;
}
