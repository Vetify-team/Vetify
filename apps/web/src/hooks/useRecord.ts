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
    consultation: useMutation({
      mutationFn: (d: CreateConsultation) => api.recordConsultation(petId, d),
      onSuccess: onRecorded,
    }),
    vaccination: useMutation({
      mutationFn: (d: CreateVaccination) => api.recordVaccination(petId, d),
      onSuccess: onRecorded,
    }),
    deworming: useMutation({
      mutationFn: (d: CreateDeworming) => api.recordDeworming(petId, d),
      onSuccess: onRecorded,
    }),
    treatment: useMutation({
      mutationFn: (d: CreateTreatment) => api.recordTreatment(petId, d),
      onSuccess: onRecorded,
    }),
    exam: useMutation({
      mutationFn: (d: CreateExam) => api.recordExam(petId, d),
      onSuccess: onRecorded,
    }),
    weight: useMutation({
      mutationFn: (d: CreateWeightEntry) => api.recordWeight(petId, d),
      onSuccess: onRecorded,
    }),
    feeding: useMutation({
      mutationFn: (d: CreateFeedingEntry) => api.recordFeeding(petId, d),
      onSuccess: onRecorded,
    }),
  };
}
