"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import { keys } from "./keys";

export function useMyClinic() {
  return useQuery({ queryKey: keys.myClinic, queryFn: () => api.myClinic() });
}

export function useIssueLinkCode() {
  return useMutation({ mutationFn: () => api.issueLinkCode() });
}

export function useAdminClinics(verified?: boolean) {
  return useQuery({
    queryKey: keys.adminClinics(verified),
    queryFn: () => api.adminClinics(verified),
  });
}

export function useSetClinicVerified() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clinicId, verified }: { clinicId: string; verified: boolean }) =>
      api.setClinicVerified(clinicId, verified),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.adminClinicsAll }),
  });
}

export function useSuspendClinic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clinicId, reason }: { clinicId: string; reason: string }) =>
      api.suspendClinic(clinicId, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.adminClinicsAll }),
  });
}

export function useReinstateClinic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clinicId: string) => api.reinstateClinic(clinicId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.adminClinicsAll }),
  });
}
