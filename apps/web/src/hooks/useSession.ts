"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LogIn, SignUp } from "@vetify/types";
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

  const login = useMutation({ mutationFn: (data: LogIn) => api.login(data) });
  const register = useMutation({ mutationFn: (data: SignUp) => api.register(data) });
  const logout = useMutation({
    mutationFn: () => api.logout(),
    // The previous session may have cached another user's data.
    onSettled: () =>
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== keys.session[0] }),
  });

  const session = query.data ?? null;
  return {
    loading: query.isPending,
    session,
    user: session?.user ?? null,
    login,
    register,
    logout,
  };
}
