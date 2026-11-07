"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/system";
import { api } from "@/lib/api-client";

type Status = "checking" | "unsupported" | "off" | "on" | "blocked" | "unconfigured";
function vapidBytes(key: string): Uint8Array<ArrayBuffer> {
  const raw = atob(
    key.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (key.length % 4)) % 4),
  );
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
export async function removeDevicePush() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  try {
    await api.unsubscribePush(subscription.endpoint);
  } finally {
    await subscription.unsubscribe();
  }
}
export function PushSettings() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const [status, setStatus] = useState<Status>("checking");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [testEnabled, setTestEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      queueMicrotask(() => setStatus("unsupported"));
      return;
    }
    let active = true;
    // Prepare the registration independently so subscribe() can run directly
    // from the user's tap, as required by WebKit.
    void navigator.serviceWorker.ready.then((reg) => {
      if (active) registrationRef.current = reg;
    });
    const check = async () => {
      try {
        const config = await Promise.race([
          api.pushConfig(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Configuration timed out")), 5000),
          ),
        ]);
        if (!active) return;
        if (!config.publicKey) {
          setStatus("unconfigured");
          return;
        }
        setPublicKey(config.publicKey);
        setTestEnabled(config.testEnabled);
        if (Notification.permission === "denied") {
          setStatus("blocked");
          return;
        }
        // Ask permission on a user tap before querying WebKit's push service.
        if (Notification.permission === "default") {
          setStatus("off");
          return;
        }
        const reg = await Promise.race([
          navigator.serviceWorker.getRegistration(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Registration timed out")), 5000),
          ),
        ]);
        if (!reg) {
          if (active) setStatus("off");
          return;
        }
        const sub = await Promise.race([
          reg.pushManager.getSubscription(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Subscription timed out")), 5000),
          ),
        ]);
        if (!active) return;
        if (!sub) {
          setStatus("off");
          return;
        }
        const { active: registered } = await api.pushSubscriptionStatus(sub.endpoint);
        if (!registered) await sub.unsubscribe();
        if (active) setStatus(registered ? "on" : "off");
      } catch {
        if (active) {
          setStatus("off");
          setError(
            "No se pudo comprobar el estado de notificaciones. Intentá activarlas.",
          );
        }
      }
    };
    void check();
    return () => {
      active = false;
    };
  }, []);
  const enable = async () => {
    setBusy(true);
    setError("");
    try {
      if (!publicKey)
        throw new Error("Las notificaciones no están configuradas en el servidor.");
      // subscribe() itself requests permission. Start it immediately from the
      // tap when the registration is ready, before awaiting other browser APIs.
      const registration = registrationRef.current;
      if (!registration)
        throw new Error(
          "El dispositivo aún no tiene listo el servicio de notificaciones.",
        );
      const subscription = await Promise.race([
        registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidBytes(publicKey),
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error("El dispositivo no respondió al registro de notificaciones."),
              ),
            15000,
          ),
        ),
      ]);
      try {
        await api.subscribePush(subscription.toJSON());
      } catch (err) {
        await subscription.unsubscribe();
        throw err;
      }
      setStatus("on");
    } catch (err) {
      const reason = err instanceof Error ? err.message : "error desconocido";
      setError(`No se pudieron activar: ${reason}`);
    } finally {
      setBusy(false);
    }
  };
  const testPush = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) throw new Error("Sin suscripción");
      await api.testPush(subscription.endpoint);
      setMessage(
        "La prueba fue aceptada por el servicio de notificaciones. Revisá este dispositivo.",
      );
    } catch {
      setError("No se pudo enviar la prueba. Revisá la suscripción y la conexión.");
    } finally {
      setBusy(false);
    }
  };
  const disable = async () => {
    setBusy(true);
    setError("");
    try {
      await removeDevicePush();
      setStatus("off");
    } catch {
      setError("No se pudieron desactivar. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title="Notificaciones al teléfono">
      <div className="flex flex-col items-start gap-3 pt-4">
        <p className="text-sm text-muted-foreground">
          Recibí recordatorios de vacunas y desparasitación. El aviso no muestra datos de
          tu mascota en la pantalla bloqueada.
        </p>
        {status === "checking" && (
          <p role="status" className="text-sm">
            Comprobando notificaciones…
          </p>
        )}
        {status === "unsupported" && (
          <p className="text-sm">
            Para activarlas en iPhone, agregá Vetify a la pantalla de inicio y abrilo
            desde ahí.
          </p>
        )}
        {status === "unconfigured" && (
          <p className="text-sm">
            Las notificaciones aún no están configuradas en el servidor.
          </p>
        )}
        {status === "blocked" && (
          <p className="text-sm">
            Las notificaciones están bloqueadas. Podés habilitarlas en los ajustes del
            dispositivo.
          </p>
        )}
        {status === "on" && (
          <Button variant="outline" disabled={busy} onClick={disable}>
            Desactivar en este dispositivo
          </Button>
        )}
        {status === "on" && testEnabled && (
          <Button variant="outline" disabled={busy} onClick={testPush}>
            Enviar notificación de prueba
          </Button>
        )}
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
        {status === "off" && (
          <Button disabled={busy} onClick={enable}>
            Activar notificaciones
          </Button>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </Section>
  );
}
