"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";

export function PublicCardLink({ petId }: { petId: string }) {
  const client = useQueryClient();
  const key = ["card-link", petId];
  const link = useQuery({
    queryKey: key,
    queryFn: () => api.cardLink(petId),
    retry: false,
  });
  const [image, setImage] = useState<{ url: string; data: string } | null>(null);
  const [failedUrl, setFailedUrl] = useState("");
  const mutation = useMutation({
    mutationFn: async (action: "create" | "revoke") =>
      action === "create" ? api.createCardLink(petId) : api.revokeCardLink(petId),
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
  const url =
    link.data?.token && typeof window !== "undefined"
      ? `${window.location.origin}/verificar#${link.data.token}`
      : "";
  useEffect(() => {
    let active = true;
    if (!url) return;
    import("qrcode")
      .then(({ default: QRCode }) => QRCode.toDataURL(url, { width: 320, margin: 2 }))
      .then((data: string) => {
        if (active) setImage({ url, data });
      })
      .catch(() => {
        if (active) {
          setImage(null);
          setFailedUrl(url);
        }
      });
    return () => {
      active = false;
    };
  }, [url]);
  const qr = image?.url === url ? image.data : "";
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {link.isLoading ? (
        <div
          className="flex w-full flex-col items-center gap-3"
          role="status"
          aria-label="Cargando carné"
        >
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-10 w-28" />
        </div>
      ) : link.isError ? (
        <p>No se pudo cargar el enlace del carné.</p>
      ) : (
        <>
          {url && !qr && failedUrl !== url && (
            <Skeleton
              className="size-[200px] shrink-0"
              role="status"
              aria-label="Generando código QR"
            />
          )}
          {url && failedUrl === url && !qr && (
            <p role="alert">No se pudo generar el código QR.</p>
          )}
          {url && qr && (
            <img
              src={qr}
              alt="Código QR para verificar el carné"
              width={200}
              height={200}
            />
          )}
          <p className="text-sm text-muted-foreground">
            {url
              ? "Cualquier persona con este QR puede ver el nombre y estado de vacunas de tu mascota."
              : "Creá un QR para compartir el estado de vacunación de tu mascota."}
          </p>
          {url && !qr && failedUrl !== url && <Skeleton className="h-5 w-28" />}
          {url && qr && (
            <a
              className="text-sm text-primary underline"
              href={qr}
              download="carne-vetify-qr.png"
            >
              Descargar QR
            </a>
          )}
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate("create")}>
            {url ? "Reemplazar QR" : "Crear QR"}
          </Button>
          {url && (
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate("revoke")}
            >
              Desactivar QR
            </Button>
          )}
          {url && (
            <p className="text-xs text-muted-foreground">
              Al reemplazar o desactivar el QR, los anteriores dejan de funcionar.
            </p>
          )}
          {mutation.isError && (
            <p role="alert" className="text-sm text-destructive">
              No se pudo actualizar el QR. Intentá de nuevo.
            </p>
          )}
        </>
      )}
    </div>
  );
}
