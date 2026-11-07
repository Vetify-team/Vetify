import type { MedicalRecord, RecordSection } from "@vetify/types";

/** Drops repeated ids, keeping the first occurrence and the order. */
const byId = <T extends { id: string }>(items: T[]): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => !seen.has(item.id) && !!seen.add(item.id));
};

/**
 * Appends an older page of one section to the loaded record. `cursor` is the
 * one the page was requested with: if the record was refetched or written in
 * the meantime, its cursor changed and the obsolete page is dropped.
 */
export function mergeRecordPage(
  current: MedicalRecord | undefined,
  page: MedicalRecord,
  section: RecordSection,
  cursor: string,
): MedicalRecord | undefined {
  if (!current || current.nextCursors[section] !== cursor) return current;
  const nextCursors = { ...current.nextCursors };
  delete nextCursors[section];
  Object.assign(nextCursors, page.nextCursors);
  return {
    ...current,
    [section]: byId<{ id: string }>([...current[section], ...page[section]]),
    nextCursors,
    clinics: byId([...current.clinics, ...page.clinics]),
    veterinarians: byId([...current.veterinarians, ...page.veterinarians]),
  };
}
