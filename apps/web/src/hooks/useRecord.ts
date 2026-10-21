"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateConsultation,
  CreateDeworming,
  CreateExam,
  CreateFeedingEntry,
  CreateTreatment,
  CreateVaccination,
  CreateWeightEntry,
  MedicalRecord,
  RecordSection,
} from "@vetify/types";
import { useIdempotentMutation } from "./useIdempotentMutation";
import { api } from "../lib/api-client";
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
      const page = await api.record(petId, { section, cursor, limit: 50 });
      return { page, section, cursor };
    },
    onSuccess: (result) => {
      if (!result) return;
      const { page, section, cursor } = result;
      queryClient.setQueryData<MedicalRecord>(keys.record(petId), (current) => {
        // A mutation/refetch may have replaced the first page while this
        // request was in flight. Never merge an obsolete page into it.
        if (!current || current.nextCursors[section] !== cursor) return current;
        const nextCursors = { ...current.nextCursors };
        delete nextCursors[section];
        Object.assign(nextCursors, page.nextCursors);
        const seen = new Set<string>();
        const entries = [...current[section], ...page[section]].filter((entry) => {
          if (seen.has(entry.id)) return false;
          seen.add(entry.id);
          return true;
        });
        const mergePeople = (
          a: MedicalRecord["clinics"],
          b: MedicalRecord["clinics"],
        ) => [...new Map([...a, ...b].map((person) => [person.id, person])).values()];
        return {
          ...current,
          [section]: entries,
          nextCursors,
          clinics: mergePeople(current.clinics, page.clinics),
          veterinarians: mergePeople(current.veterinarians, page.veterinarians),
        };
      });
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
      queryClient.invalidateQueries({ queryKey: ["pets", petId, "access-log"] }),
      queryClient.invalidateQueries({ queryKey: keys.alerts }),
    ]);

  return {
    consultation: useIdempotentMutation(
      (d: CreateConsultation, key) => api.recordConsultation(petId, d, key),
      onRecorded,
    ),
    vaccination: useIdempotentMutation(
      (d: CreateVaccination, key) => api.recordVaccination(petId, d, key),
      onRecorded,
    ),
    deworming: useIdempotentMutation(
      (d: CreateDeworming, key) => api.recordDeworming(petId, d, key),
      onRecorded,
    ),
    treatment: useIdempotentMutation(
      (d: CreateTreatment, key) => api.recordTreatment(petId, d, key),
      onRecorded,
    ),
    exam: useIdempotentMutation(
      (d: CreateExam, key) => api.recordExam(petId, d, key),
      onRecorded,
    ),
    weight: useIdempotentMutation(
      (d: CreateWeightEntry, key) => api.recordWeight(petId, d, key),
      onRecorded,
    ),
    feeding: useIdempotentMutation(
      (d: CreateFeedingEntry, key) => api.recordFeeding(petId, d, key),
      onRecorded,
    ),
  };
}
