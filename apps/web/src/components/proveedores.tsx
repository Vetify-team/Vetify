"use client";

import { SerwistProvider } from "@serwist/next/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * Proveedores de cliente de toda la app: caché de datos del servidor y
 * registro del service worker de la PWA.
 */
export function Proveedores({ children }: { children: ReactNode }) {
  const [clienteQuery] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            // Es una PWA: si el usuario se queda sin señal, conviene seguir
            // mostrando lo ya cacheado en vez de vaciar la pantalla.
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <SerwistProvider
      swUrl="/sw.js"
      disable={process.env.NODE_ENV === "development"}
      reloadOnOnline
    >
      <QueryClientProvider client={clienteQuery}>{children}</QueryClientProvider>
    </SerwistProvider>
  );
}
