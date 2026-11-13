"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import type { InboxItem } from "../lib/inbox";

const KEY = ["notifications"] as const;
const now = () => new Date().toISOString();

/** A change to the inbox shown at once and rolled back if the API refuses it. */
function useInboxChange<T>(
  run: (input: T) => Promise<unknown>,
  change: (items: InboxItem[], input: T) => InboxItem[],
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onMutate: async (input: T) => {
      await client.cancelQueries({ queryKey: KEY });
      const before = client.getQueryData<InboxItem[]>(KEY);
      if (before) client.setQueryData(KEY, change(before, input));
      return { before };
    },
    onError: (_error, _input, context) => {
      if (context?.before) client.setQueryData(KEY, context.before);
    },
    onSettled: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

/** The owner's inbox and what can be done with it. */
export function useInbox() {
  const query = useQuery({ queryKey: KEY, queryFn: () => api.notifications() });
  const read = useInboxChange(
    (id: string) => api.markNotificationRead(id),
    (items, id) =>
      items.map((i) => (i.id === id ? { ...i, readAt: i.readAt ?? now() } : i)),
  );
  const readAll = useInboxChange(
    (_: void) => api.markAllNotificationsRead(),
    (items) => items.map((i) => ({ ...i, readAt: i.readAt ?? now() })),
  );
  const dismiss = useInboxChange(
    (id: string) => api.dismissNotification(id),
    (items, id) => items.filter((i) => i.id !== id),
  );
  return { ...query, read, readAll, dismiss };
}
