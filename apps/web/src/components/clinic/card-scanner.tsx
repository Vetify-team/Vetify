"use client";

import { Camera, CameraOff, Link2, ScanLine, ShieldAlert } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { errorMessage } from "@/lib/errors";
import { FormError } from "@/components/fields";
import { PublicCardView, type PublicCard } from "@/components/pets/public-card-view";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { tokenFromCardLink } from "@/lib/card";
import { SITE_URLS } from "@/lib/sites";

/** The owner site of this deployment: only its cards are accepted. */
const ownerOrigin = () => SITE_URLS.owner ?? window.location.origin;

type Detect = (video: HTMLVideoElement) => Promise<string | null>;

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type BarcodeDetectorClass = {
  new (options: { formats: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

/**
 * Reads a QR from the camera: the browser's BarcodeDetector where there is
 * one (Chrome, Edge, Android), else jsQR, loaded only then, on a frame drawn
 * to a canvas.
 */
async function makeDetector(): Promise<Detect> {
  const Native = (window as unknown as { BarcodeDetector?: BarcodeDetectorClass })
    .BarcodeDetector;
  if (Native && (await Native.getSupportedFormats?.())?.includes("qr_code")) {
    const detector = new Native({ formats: ["qr_code"] });
    return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
  }
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  return async (video) => {
    if (!context || !video.videoWidth) return null;
    // A smaller frame is enough for a QR held in front of the camera.
    const scale = Math.min(1, 640 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(image.data, image.width, image.height)?.data ?? null;
  };
}

type State =
  | { kind: "starting" }
  | { kind: "scanning" }
  | { kind: "no-camera"; reason: string }
  | { kind: "checking" }
  | { kind: "result"; card: PublicCard; at: Date; token: string }
  | { kind: "error"; message: string };

/**
 * The clinic scans an owner's public card and sees, inside the portal, the
 * same vaccine status as /verificar. Only Vetify cards of this environment
 * are read; anything else is refused before calling the API. Without a camera
 * (or without permission) the link can be pasted.
 */
export function CardScanner() {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [state, setState] = useState<State>({ kind: "starting" });
  const [notice, setNotice] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);

  const verify = useCallback(
    async (token: string) => {
      stop();
      setState({ kind: "checking" });
      try {
        setState({
          kind: "result",
          card: await api.verifyCard(token),
          at: new Date(),
          token,
        });
      } catch {
        setState({
          kind: "error",
          message: "Este carné no es válido o el dueño desactivó el QR.",
        });
      }
    },
    [stop],
  );

  /** Opens the camera; every state change happens after it answers. */
  const openCamera = useCallback(() => {
    const devices = navigator.mediaDevices;
    // Even "no camera API" arrives as a rejection: every state change
    // happens in a callback, once the browser answers.
    return (
      devices?.getUserMedia
        ? devices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          })
        : Promise.reject(new Error("unsupported"))
    ).then(
      async (opened) => {
        stream.current = opened;
        if (!video.current) return stop();
        video.current.srcObject = opened;
        await video.current.play().catch(() => undefined);
        setState({ kind: "scanning" });
      },
      (error: unknown) => {
        const denied = error instanceof DOMException && error.name === "NotAllowedError";
        setState({
          kind: "no-camera",
          reason: !devices?.getUserMedia
            ? "Este navegador no puede usar la cámara."
            : denied
              ? "No diste permiso para usar la cámara."
              : "No encontramos una cámara en este dispositivo.",
        });
      },
    );
  }, [stop]);

  /** Tries again (another card, or after allowing the camera). */
  const start = () => {
    setNotice(null);
    setState({ kind: "starting" });
    void openCamera();
  };

  // Start the camera on arrival; release it on leaving.
  useEffect(() => {
    void openCamera();
    return stop;
  }, [openCamera, stop]);

  // While scanning, look at a frame a few times a second.
  useEffect(() => {
    if (state.kind !== "scanning") return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    void makeDetector().then((detect) => {
      const tick = async () => {
        if (!active || !video.current) return;
        const text = await detect(video.current).catch(() => null);
        if (!active) return;
        if (text) {
          const token = tokenFromCardLink(text, ownerOrigin());
          if (token) return void verify(token);
          setNotice("Ese código no es un carné de Vetify.");
        }
        timer = setTimeout(() => void tick(), 250);
      };
      void tick();
    });
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [state.kind, verify]);

  const submitPaste = (event: FormEvent) => {
    event.preventDefault();
    const token = tokenFromCardLink(pasted, ownerOrigin());
    if (!token)
      return setPasteError(
        "Ese enlace no es un carné de Vetify. Revisá que esté completo.",
      );
    setPasteError(null);
    void verify(token);
  };

  const again = () => {
    setPasted("");
    start();
  };

  if (state.kind === "checking")
    return (
      <div
        role="status"
        aria-label="Verificando el carné"
        className="flex flex-col gap-4"
      >
        <Skeleton className="h-14 w-2/3" />
        <Skeleton className="h-8 w-1/2 rounded-full" />
        <Skeleton className="h-44 w-full rounded-3xl" />
      </div>
    );

  if (state.kind === "result")
    return (
      <div className="flex flex-col gap-6">
        <PublicCardView card={state.card} checkedAt={state.at} />
        <AskAccess token={state.token} />
        <Button
          variant="outline"
          size="lg"
          className="w-fit rounded-full"
          onClick={again}
        >
          <ScanLine aria-hidden /> Escanear otro carné
        </Button>
      </div>
    );

  if (state.kind === "error")
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-3xl bg-card p-6 shadow-sm"
      >
        <ShieldAlert className="size-8 text-alert" strokeWidth={1.5} aria-hidden />
        <p className="font-display text-3xl leading-tight">No se pudo verificar</p>
        <p className="text-muted-foreground">{state.message}</p>
        <Button variant="solido" onClick={again}>
          <ScanLine aria-hidden /> Intentar de nuevo
        </Button>
      </div>
    );

  const noCamera = state.kind === "no-camera";
  return (
    <div className="flex flex-col gap-6">
      {noCamera ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-3xl bg-card p-5 shadow-sm"
        >
          <CameraOff
            className="mt-0.5 size-6 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <div className="flex flex-col items-start gap-2">
            <p className="font-medium">{state.reason}</p>
            <p className="text-sm text-muted-foreground">
              Pegá abajo el enlace del carné, o permití la cámara en el navegador y probá
              de nuevo.
            </p>
            <Button variant="outline" size="sm" onClick={start}>
              <Camera aria-hidden /> Probar la cámara de nuevo
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-3xl bg-black">
          <video
            ref={video}
            muted
            playsInline
            aria-label="Vista de la cámara"
            className="size-full object-cover"
          />
          {/* The frame to aim at. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-[18%] rounded-3xl border-4 border-white/85 shadow-[0_0_0_100vmax_rgba(0,0,0,0.35)]"
          />
          {state.kind === "starting" && (
            <p
              role="status"
              className="absolute inset-x-0 bottom-4 text-center text-sm text-white"
            >
              Abriendo la cámara…
            </p>
          )}
        </div>
      )}
      {!noCamera && (
        <p aria-live="polite" className="text-center text-sm text-muted-foreground">
          {notice ?? "Apuntá la cámara al QR del carné del dueño."}
        </p>
      )}

      <form
        onSubmit={submitPaste}
        noValidate
        className="flex flex-col gap-2 rounded-3xl bg-card p-5 shadow-sm"
      >
        <label
          htmlFor="card-link"
          className="flex items-center gap-2 text-sm font-medium"
        >
          <Link2 className="size-4 text-muted-foreground" aria-hidden /> O pegá el enlace
          del carné
        </label>
        <div className="flex gap-2">
          <input
            id="card-link"
            value={pasted}
            onChange={(event) => {
              setPasted(event.target.value);
              setPasteError(null);
            }}
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://app.vetify.live/verificar#…"
            aria-invalid={!!pasteError}
            aria-describedby="card-link-error"
            className="h-11 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
          />
          <Button type="submit" variant="solido" className="h-11">
            Verificar
          </Button>
        </div>
        <div id="card-link-error">
          <FormError message={pasteError} />
        </div>
      </form>
    </div>
  );
}

/**
 * From a scanned card, the clinic asks the owner for the full record. The
 * owner approves or rejects it in "Quién puede verlo"; the card alone grants
 * nothing more.
 */
function AskAccess({ token }: { token: string }) {
  const ask = useMutation({ mutationFn: () => api.requestCardAccess(token) });
  if (ask.data)
    return (
      <p role="status" className="rounded-2xl bg-ok/12 p-4 text-sm text-ok">
        {ask.data.status === "already"
          ? `Ya tenés el expediente completo de ${ask.data.petName}.`
          : `Le pedimos acceso al dueño de ${ask.data.petName}. Cuando lo apruebe, aparece en tus pacientes.`}
      </p>
    );
  return (
    <div className="flex flex-col items-start gap-2 rounded-2xl bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">
        ¿Lo vas a atender? Pedile al dueño acceso al expediente completo.
      </p>
      <Button
        variant="solido"
        className="rounded-full"
        disabled={ask.isPending}
        onClick={() => ask.mutate()}
      >
        {ask.isPending ? "Enviando…" : "Pedir acceso al expediente"}
      </Button>
      <FormError message={ask.isError ? errorMessage(ask.error) : null} />
    </div>
  );
}
