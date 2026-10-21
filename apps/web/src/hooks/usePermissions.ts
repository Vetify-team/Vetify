"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { GrantPermission } from "@vetify/types";
import { api } from "../lib/api-client";
import { keys } from "./keys";

export function usePermissions(petId: string) {
  return useQuery({
    queryKey: keys.permissions(petId),
    queryFn: () => api.permissions(petId),
  });
}

/** Paginated access log, newest first. */
export function useAccessLog(petId: string, actor: "all" | "others") {
  return useInfiniteQuery({
    queryKey: keys.accessLog(petId, actor),
    queryFn: ({ pageParam }) => api.accessLog(petId, { actor, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

export function useManagePermissions(petId: string) {
  const queryClient = useQueryClient();
  const onChange = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.permissions(petId) }),
      queryClient.invalidateQueries({ queryKey: ["pets", petId, "access-log"] }),
    ]);

  return {
    preview: useMutation({ mutationFn: (code: string) => api.previewLinkCode(code) }),
    grant: useMutation({
      mutationFn: (data: GrantPermission) => api.grantPermission(petId, data),
      onSuccess: onChange,
    }),
    revoke: useMutation({
      mutationFn: (id: string) => api.revokePermission(petId, id),
      onSuccess: onChange,
    }),
    restore: useMutation({
      mutationFn: (id: string) => api.restorePermission(petId, id),
      onSuccess: onChange,
    }),
  };
}
