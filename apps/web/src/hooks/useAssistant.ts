"use client";

import type { AssistantMessage } from "@vetify/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import { keys } from "./keys";

/**
 * Sends the conversation to the pet assistant. The conversation itself lives
 * in the chat component; the hook only carries the request and refreshes the
 * month's usage the answer brings back.
 */
export function useAssistant(petId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messages: AssistantMessage[]) => api.assistant.send(petId, messages),
    onSuccess: ({ usage }) => queryClient.setQueryData(keys.assistantUsage(petId), usage),
  });
}

/** This month's messages and the allowance (`limit` null: unlimited). */
export function useAssistantUsage(petId: string, enabled = true) {
  return useQuery({
    queryKey: keys.assistantUsage(petId),
    queryFn: () => api.assistant.usage(petId),
    enabled,
  });
}
