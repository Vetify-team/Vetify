"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateClinicInvitation } from "@vetify/types";
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

export function useTeam(enabled: boolean) {
  return useQuery({ queryKey: keys.team, queryFn: () => api.team(), enabled });
}

export function useInvitations(enabled: boolean) {
  return useQuery({
    queryKey: keys.invitations,
    queryFn: () => api.invitations(),
    enabled,
  });
}

/** Invite, withdraw an invitation, remove a member; each refreshes the lists. */
export function useManageTeam() {
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.team }),
      queryClient.invalidateQueries({ queryKey: keys.invitations }),
    ]);
  return {
    invite: useMutation({
      mutationFn: (data: CreateClinicInvitation) => api.invite(data),
      onSuccess: refresh,
    }),
    revoke: useMutation({
      mutationFn: (invitationId: string) => api.revokeInvitation(invitationId),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (userId: string) => api.removeMember(userId),
      onSuccess: refresh,
    }),
  };
}
