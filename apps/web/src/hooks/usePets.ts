"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreatePet, UpdatePet } from "@vetify/types";
import { useIdempotentMutation } from "./useIdempotentMutation";
import { api } from "../lib/api-client";
import { keys } from "./keys";

/** The owner's pets, or the clinic's patients with an active permission. */
export function usePets(enabled = true) {
  return useQuery({ queryKey: keys.pets(), queryFn: () => api.pets(), enabled });
}

/** `enabled` waits for an id that is not known yet (a pet being created). */
export function usePet(id: string, enabled = id !== "") {
  return useQuery({ queryKey: keys.pet(id), queryFn: () => api.pet(id), enabled });
}

/**
 * Alerts are derived from each pet's species and birth date, so creating or
 * editing a pet changes them too.
 */
export function useCreatePet() {
  const queryClient = useQueryClient();
  return useIdempotentMutation(
    (data: CreatePet, key) => api.createPet(data, key),
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.pets() }),
        queryClient.invalidateQueries({ queryKey: keys.alerts }),
      ]),
  );
}

export function useUpdatePet(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdatePet) => api.updatePet(id, data),
    onSuccess: (pet) => {
      queryClient.setQueryData(keys.pet(id), pet);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.pets(), exact: true }),
        queryClient.invalidateQueries({ queryKey: keys.vaccinationStatus(id) }),
        queryClient.invalidateQueries({ queryKey: keys.alerts }),
      ]);
    },
  });
}
