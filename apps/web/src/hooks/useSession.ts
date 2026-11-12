"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AcceptClinicInvitation, LogIn, SignUp } from "@vetify/types";
import { api } from "../lib/api-client";
import { keys } from "./keys";

/**
 * The user's session. Like every hook in this folder it imports nothing from
 * `next/*`, so it could be reused from apps/mobile.
 *
 * On load the session is restored through the refresh cookie; until that
 * answers, `loading` is true (also on the server render).
 */
export function useSession() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: keys.session,
    queryFn: () => api.restore(),
    staleTime: Infinity,
    retry: false,
  });

  // What the ended session cached; it may belong to another user next.
  const clearUserQueries = () =>
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== keys.session[0] });

  const login = useMutation({ mutationFn: (data: LogIn) => api.login(data) });
  const register = useMutation({ mutationFn: (data: SignUp) => api.register(data) });
  const acceptInvitation = useMutation({
    mutationFn: (data: AcceptClinicInvitation) => api.acceptInvitation(data),
  });
  const logout = useMutation({
    mutationFn: async () => {
      try {
        const { removeDevicePush } = await import("@/components/owner/push-settings");
        await removeDevicePush();
      } catch {
        // Logout still revokes the session if the device cannot unregister.
      }
      await api.logout();
    },
    onSettled: () => clearUserQueries(),
  });

  const deleteAccount = useMutation({
    mutationFn: async (password: string) => {
      await api.deleteAccount(password);
      try {
        const { forgetDevicePush } = await import("@/components/owner/push-settings");
        await forgetDevicePush();
      } catch {
        // The API already deleted the subscription; this device just keeps a dead one.
      }
    },
    onSuccess: () => clearUserQueries(),
  });

  const session = query.data ?? null;
  return {
    loading: query.isPending,
    session,
    user: session?.user ?? null,
    login,
    register,
    acceptInvitation,
    logout,
    deleteAccount,
  };
}
