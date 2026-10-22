"use client";

import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { ApiRequestError } from "../lib/api-client";

/** Keep an uncertain form submission's key for a manual retry of the same data.
 * Success completes the intent; the next submission always gets a new key.
 * Keys never persist to disk and there is no offline write queue.
 */
export function useIdempotentMutation<TData, TResult>(
  write: (data: TData, key: string) => Promise<TResult>,
  onSuccess: (result: TResult) => unknown,
) {
  const pending = useRef<{ payload: string; key: string } | null>(null);
  return useMutation({
    mutationFn: async (data: TData) => {
      const payload = JSON.stringify(data);
      if (!pending.current || pending.current.payload !== payload) {
        pending.current = { payload, key: crypto.randomUUID() };
      }
      const attempt = pending.current;
      try {
        const result = await write(data, attempt.key);
        if (pending.current === attempt) pending.current = null;
        return result;
      } catch (error) {
        // An explicit client rejection did not save a write. Preserve uncertain
        // network/server outcomes for safe retries; new data is a new intent.
        if (
          error instanceof ApiRequestError &&
          error.status >= 400 &&
          error.status < 500 &&
          error.status !== 429
        ) {
          if (pending.current === attempt) pending.current = null;
        }
        throw error;
      }
    },
    onSuccess,
  });
}
