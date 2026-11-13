"use client";

import type { Pet } from "@vetify/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Download, Expand, QrCode, Share2, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "cn";
import { FormError } from "@/components/fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { cardVerifyUrl } from "@/lib/card";
import { ExportPdfButton } from "./export-pdf-button";

/** The QR image of a URL, as a PNG data URL: dark ink on white, so any camera reads it. */
function useQrImage(url: string, width: number) {
  const [image, setImage] = useState<{ key: string; data: string | null } | null>(null);
  const key = `${width}:${url}`;
  useEffect(() => {
    if (!url) return;
    let active = true;
    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(url, {
          width,
          margin: 2,
          errorCorrectionLevel: "M",
          color: { dark: "#1d1b18", light: "#ffffff" },
        }),
      )
      .then((data: string) => active && setImage({ key, data }))
      .catch(() => active && setImage({ key, data: null }));
    return () => {
      active = false;
    };
  }, [url, width, key]);
  return image?.key === key ? image.data : undefined;
}

/**
 * The card's public QR: off until the owner turns it on; then a large QR to
 * show or project, a link to share or copy, the PNG and the PDF, and a way to
 * replace or turn it off (both stop the old QR at once).
 */
export function PublicCardLink({ pet }: { pet: Pet }) {
  const client = useQueryClient();
  const key = ["card-link", pet.id];
  const link = useQuery({
    queryKey: key,
    queryFn: () => api.cardLink(pet.id),
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: async (action: "create" | "revoke") =>
      action === "create" ? api.createCardLink(pet.id) : api.revokeCardLink(pet.id),
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
  const [confirm, setConfirm] = useState<"replace" | "revoke" | null>(null);
  const [projecting, setProjecting] = useState(false);
  const [copied, setCopied] = useState(false);

  const url =
    link.data?.token && typeof window !== "undefined"
      ? cardVerifyUrl(window.location.origin, link.data.token)
      : "";
  const qr = useQrImage(url, 720);

  if (link.isLoading)
    return (
      <div
        role="status"
        aria-label="Cargando el QR"
        className="flex flex-col items-center gap-4"
      >
        <Skeleton className="size-60 rounded-2xl" />
        <Skeleton className="h-10 w-48" />
      </div>
    );
  if (link.isError)
    return <FormError message="No se pudo cargar el QR del carné. Recargá la página." />;

  if (!url)
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <QrCode className="size-8" strokeWidth={1.5} aria-hidden />
        </span>
        <div>
          <p className="font-display text-2xl">Carné público con QR</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Un hospedaje, una guardería o una aerolínea lo escanea y ve solo el nombre de{" "}
            {pet.name} y la vigencia de sus vacunas. Nada más del expediente.
          </p>
        </div>
        <Button
          variant="solido"
          size="lg"
          className="rounded-full"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("create")}
        >
          <QrCode aria-hidden /> {mutation.isPending ? "Activando…" : "Activar el QR"}
        </Button>
        <FormError message={mutation.isError ? errorMessage(mutation.error) : null} />
      </div>
    );

  const share = async () => {
    const data = {
      title: `Carné de ${pet.name}`,
      text: `Carné de vacunación de ${pet.name}`,
      url,
    };
    if (navigator.share && navigator.canShare?.(data) !== false) {
      await navigator.share(data).catch(() => undefined);
      return;
    }
    await copy();
  };
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <button
        type="button"
        onClick={() => setProjecting(true)}
        aria-label="Mostrar el QR en pantalla completa"
        className="group relative rounded-3xl bg-white p-3 shadow-[0_1px_2px_rgba(29,27,24,0.08),0_10px_30px_rgba(29,27,24,0.1)] outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
      >
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data URL built here
          <img
            src={qr}
            alt={`Código QR del carné de ${pet.name}`}
            width={260}
            height={260}
            className="size-64 sm:size-72"
          />
        ) : qr === null ? (
          <p role="alert" className="flex size-64 items-center p-6 text-sm sm:size-72">
            No se pudo generar el código QR.
          </p>
        ) : (
          <Skeleton className="size-64 sm:size-72" />
        )}
        <span className="absolute right-4 bottom-4 flex size-8 items-center justify-center rounded-full bg-foreground/80 text-background opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Expand className="size-4" aria-hidden />
        </span>
      </button>

      <p className="max-w-sm text-center text-sm text-muted-foreground">
        Quien lo escanee ve solo el nombre y la vigencia de las vacunas.
      </p>

      <div className="grid w-full max-w-md grid-cols-2 gap-2">
        <Button
          variant="solido"
          className="col-span-2 h-11 rounded-full"
          onClick={() => setProjecting(true)}
        >
          <Expand aria-hidden /> Mostrar en pantalla completa
        </Button>
        <Button variant="outline" className="h-11" onClick={() => void share()}>
          {copied ? <Check aria-hidden /> : <Share2 aria-hidden />}
          {copied ? "Enlace copiado" : "Compartir"}
        </Button>
        <Button variant="outline" className="h-11" onClick={() => void copy()}>
          <Copy aria-hidden /> Copiar enlace
        </Button>
        {qr && (
          <a
            href={qr}
            download={`carne-${pet.name.toLowerCase()}-qr.png`}
            className="col-span-1 inline-flex h-11 items-center justify-center gap-1.5 rounded-md border border-border text-sm font-medium transition-colors hover:bg-muted"
          >
            <Download className="size-4" aria-hidden /> QR en imagen
          </a>
        )}
        <div
          className={cn(
            qr ? "col-span-1" : "col-span-2",
            "[&_a]:h-auto [&_a]:min-h-11 [&_a]:w-full [&_a]:text-center [&_a]:whitespace-normal [&_button]:h-11 [&_button]:w-full",
          )}
        >
          <ExportPdfButton pet={pet} kind="card" label="Carné en PDF" />
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm">
        <button
          type="button"
          onClick={() => setConfirm("replace")}
          className="text-primary underline underline-offset-4"
        >
          Generar un QR nuevo
        </button>
        <button
          type="button"
          onClick={() => setConfirm("revoke")}
          className="text-alert underline underline-offset-4"
        >
          Desactivar el QR
        </button>
      </div>
      <FormError message={mutation.isError ? errorMessage(mutation.error) : null} />

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent className="gap-5 rounded-2xl p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-medium">
              {confirm === "revoke" ? "¿Desactivar el QR?" : "¿Generar un QR nuevo?"}
            </DialogTitle>
            <DialogDescription>
              {confirm === "revoke"
                ? "El QR actual deja de funcionar de inmediato y nadie más podrá ver el carné hasta que lo actives de nuevo."
                : "El QR actual deja de funcionar de inmediato. Usalo si compartiste el anterior con alguien que ya no debería verlo."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-6 -mb-6 rounded-b-2xl px-6">
            <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
            <Button
              variant={confirm === "revoke" ? "destructive" : "solido"}
              disabled={mutation.isPending}
              onClick={() =>
                mutation.mutate(confirm === "revoke" ? "revoke" : "create", {
                  onSuccess: () => setConfirm(null),
                })
              }
            >
              {confirm === "revoke" ? "Desactivar" : "Generar uno nuevo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProjectQr open={projecting} onOpenChange={setProjecting} pet={pet} url={url} />
    </div>
  );
}

/**
 * The QR as large as the screen allows, on white, to project it for a room
 * or hold the phone up to a reader. Escape or the button closes it.
 */
function ProjectQr({
  open,
  onOpenChange,
  pet,
  url,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pet: Pet;
  url: string;
}) {
  const qr = useQrImage(open ? url : "", 1200);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="fixed inset-0 top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col items-center justify-center gap-6 rounded-none bg-white p-6 text-[#1d1b18] ring-0 sm:max-w-none"
      >
        <DialogTitle className="text-center font-display text-4xl font-medium sm:text-5xl">
          Carné de {pet.name}
        </DialogTitle>
        <DialogDescription className="text-center text-base text-[#6a645a]">
          Escaneá el código con la cámara del teléfono
        </DialogDescription>
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data URL built here
          <img
            src={qr}
            alt={`Código QR del carné de ${pet.name}`}
            className="aspect-square w-[min(80vw,68vh)]"
          />
        ) : (
          <Skeleton className="aspect-square w-[min(80vw,68vh)] bg-[#ebe4d6]" />
        )}
        <p className="font-display text-xl">Vetify</p>
        <DialogClose
          render={
            <Button
              variant="outline"
              size="icon-lg"
              className="absolute top-[calc(env(safe-area-inset-top)+1rem)] right-4 border-[#d8cfbf] bg-white text-[#1d1b18] hover:bg-[#f4efe5]"
            />
          }
        >
          <XIcon aria-hidden />
          <span className="sr-only">Cerrar</span>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
