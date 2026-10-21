"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreatePet, UpdatePet } from "@vetify/types";
import { api } from "../lib/api-client";
import { keys } from "./keys";

/** The owner's pets, or the clinic's patients with an active permission. */
export function usePets() {
  return useQuery({ queryKey: keys.pets(), queryFn: () => api.pets() });
}

export function usePet(id: string) {
  return useQuery({ queryKey: keys.pet(id), queryFn: () => api.pet(id) });
}

export function useCreatePet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePet) => api.createPet(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.pets() }),
  });
}

export function useUpdatePet(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdatePet) => api.updatePet(id, data),
    onSuccess: (pet) => {
      queryClient.setQueryData(keys.pet(id), pet);
      return queryClient.invalidateQueries({ queryKey: keys.pets(), exact: true });
    },
  });
}
