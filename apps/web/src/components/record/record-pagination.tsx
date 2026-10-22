"use client";

import { recordSectionSchema, type RecordSection } from "@vetify/types";
import { Button } from "@/components/ui/button";
import { useRecord } from "@/hooks/useRecord";
import { errorMessage } from "@/lib/errors";

const LABELS: Record<RecordSection, string> = {
  consultations: "consultas",
  vaccinations: "vacunas",
  dewormings: "desparasitaciones",
  treatments: "tratamientos",
  exams: "exámenes",
  weightEntries: "pesos",
  feedingEntries: "observaciones",
};

/** Older entries remain reachable without loading the entire record at once. */
export function RecordPagination({
  petId,
  section,
}: {
  petId: string;
  section?: RecordSection;
}) {
  const record = useRecord(petId);
  const sections = section ? [section] : recordSectionSchema.options;
  const remaining = sections.filter((key) => record.data?.nextCursors[key]);
  if (!remaining.length && !record.loadMoreError) return null;
  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="flex flex-wrap gap-2">
        {remaining.map((key) => (
          <Button
            key={key}
            type="button"
            disabled={record.isLoadingMore}
            onClick={() => record.loadMore(key)}
          >
            Cargar más {LABELS[key]}
          </Button>
        ))}
      </div>
      {record.loadMoreError && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(record.loadMoreError)}
        </p>
      )}
    </div>
  );
}
