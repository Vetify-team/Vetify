"use client";

import { SerwistProvider } from "@serwist/next/react";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { claves } from "@/hooks/claves";
import { ErrorDeApi } from "@/lib/api-client";
import { aplicarTema, leerTema } from "@/lib/tema";

/**
 * Proveedores de cliente de toda la app: caché de datos del servidor y
 * registro del service worker de la PWA.
 */
export function Proveedores({ children }: { children: ReactNode }) {
  const [clienteQuery] = useState(() => {
    const cliente: QueryClient = new QueryClient({
      // Un 401 que sobrevivió al refresco significa que la sesión murió: se
      // vacía y RutaProtegida manda al login.
      queryCache: new QueryCache({
        onError: (error) => {
          if (error instanceof ErrorDeApi && error.estado === 401) {
            cliente.setQueryData(claves.sesion, null);
          }
        },
      }),
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,
          // Es una PWA: si el usuario se queda sin señal, conviene seguir
          // mostrando lo ya cacheado en vez de vaciar la pantalla.
          retry: 1,
          refetchOnWindowFocus: false,
        },
      },
    });
    return cliente;
  });

  // Con el tema "como el sistema", seguir los cambios del sistema en vivo.
  useEffect(() => {
    const consulta = window.matchMedia("(prefers-color-scheme: dark)");
    const alCambiar = () => {
      if (leerTema() === "sistema") aplicarTema("sistema");
    };
    consulta.addEventListener("change", alCambiar);
    return () => consulta.removeEventListener("change", alCambiar);
  }, []);

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
