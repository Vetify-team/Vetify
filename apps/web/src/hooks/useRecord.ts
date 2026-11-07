"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DEFAULT_PAGE_SIZE,
  type CreateEntry,
  type MedicalRecord,
  type RecordSection,
} from "@vetify/types";
import { useIdempotentMutation } from "./useIdempotentMutation";
import { api } from "../lib/api-client";
import { mergeRecordPage } from "../lib/record-pages";
import { keys } from "./keys";

export function useRecord(petId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: keys.record(petId),
    queryFn: () => api.record(petId),
  });
  const more = useMutation({
    mutationFn: async (section: RecordSection) => {
      const cursor = queryClient.getQueryData<MedicalRecord>(keys.record(petId))
        ?.nextCursors[section];
      if (!cursor) return null;
      const page = await api.record(petId, { section, cursor, limit: DEFAULT_PAGE_SIZE });
      return { page, section, cursor };
    },
    onSuccess: (result) => {
      if (!result) return;
      const { page, section, cursor } = result;
      queryClient.setQueryData<MedicalRecord>(keys.record(petId), (current) =>
        mergeRecordPage(current, page, section, cursor),
      );
    },
  });
  return {
    ...query,
    loadMore: more.mutate,
    isLoadingMore: more.isPending,
    loadMoreError: more.error,
  };
}

/** Alerts of every pet of the owner, or of the clinic's patients. */
export function useAlerts() {
  return useQuery({ queryKey: keys.alerts, queryFn: () => api.alerts() });
}

export function useVaccinationStatus(petId: string) {
  return useQuery({
    queryKey: keys.vaccinationStatus(petId),
    queryFn: () => api.vaccinationStatus(petId),
  });
}

/**
 * Record entries. Any new entry invalidates the record, the vaccination
 * status (a new vaccine changes coverage), the alerts and the access log.
 */
export function useRecordEntries(petId: string) {
  const queryClient = useQueryClient();
  const onRecorded = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.record(petId) }),
      queryClient.invalidateQueries({ queryKey: keys.vaccinationStatus(petId) }),
      queryClient.invalidateQueries({ queryKey: keys.petAccessLog(petId) }),
      queryClient.invalidateQueries({ queryKey: keys.alerts }),
    ]);

  const useEntry = <S extends RecordSection>(section: S) =>
    useIdempotentMutation(
      (data: CreateEntry[S], key) => api.recordEntry(petId, section, data, key),
      onRecorded,
    );

  return {
    consultations: useEntry("consultations"),
    vaccinations: useEntry("vaccinations"),
    dewormings: useEntry("dewormings"),
    treatments: useEntry("treatments"),
    exams: useEntry("exams"),
    weightEntries: useEntry("weightEntries"),
    feedingEntries: useEntry("feedingEntries"),
  };
}
