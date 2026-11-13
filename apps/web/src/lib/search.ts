import type { Pet } from "@vetify/types";
import { speciesLabel } from "./labels";

/** Lower case without accents or extra spaces: "Ñandú  " and "nandu" match. */
export const normalizeSearch = (text: string): string =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Whether a patient matches what the clinic typed: every word must appear in
 * its name, breed, species or microchip. An empty search matches everything.
 */
export function matchesPet(pet: Pet, query: string): boolean {
  const words = normalizeSearch(query).split(" ").filter(Boolean);
  if (!words.length) return true;
  const haystack = normalizeSearch(
    [pet.name, pet.breed, speciesLabel[pet.species], pet.microchip]
      .filter(Boolean)
      .join(" "),
  );
  return words.every((word) => haystack.includes(word));
}
