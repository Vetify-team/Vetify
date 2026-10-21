"use client";

import { SerwistProvider } from "@serwist/next/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { keys } from "@/hooks/keys";
import { api } from "@/lib/api-client";
import { applyTheme, readTheme } from "@/lib/theme";

/** Client providers for the whole app: server data cache and the PWA's service worker. */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60 * 1000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  // Login, refresh and logout update the session everywhere; when it ends,
  // ProtectedRoute sends the user to the login screen. Subscribed in an
  // effect so it is bound to the client React keeps (StrictMode runs state
  // initializers twice).
  useEffect(
    () => api.subscribe((session) => queryClient.setQueryData(keys.session, session)),
    [queryClient],
  );

  // With the "system" theme, follow system changes live.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readTheme() === "system") applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return (
    <SerwistProvider
      swUrl="/sw.js"
      disable={process.env.NODE_ENV === "development"}
      reloadOnOnline
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SerwistProvider>
  );
}
