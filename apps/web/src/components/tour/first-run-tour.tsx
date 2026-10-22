"use client";

import type { SignUpRole } from "@vetify/types";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import "./tour.css";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { homeOf } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMyClinic } from "@/hooks/useClinic";
import { usePets } from "@/hooks/usePets";
import { useSession } from "@/hooks/useSession";
import { firstName } from "@/lib/onboarding";
import {
  clearTourPending,
  isTourPending,
  subscribeTourPending,
  tourSteps,
  type TourStep,
  type TourTarget,
} from "@/lib/tour";

/** Navigation exists twice (phone and desktop): the tour uses the one on screen. */
function visibleTarget(target: TourTarget): Element | undefined {
  return [...document.querySelectorAll(`[data-tour="${target}"]`)].find(
    (el) => el.getClientRects().length > 0,
  );
}

type Phase = "idle" | "running" | "done";

/**
 * The first-run guided tour on the role's home: an invitation, the steps
 * (driver.js) and a closing note. It runs when the sign-up wizard, or Ajustes,
 * left the pending mark; `ready` holds it until the page's data has rendered.
 */
function Tour({
  role,
  steps,
  ready,
}: {
  role: SignUpRole;
  steps: TourStep[];
  ready: boolean;
}) {
  const { user } = useSession();
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const tour = useRef<Driver | null>(null);
  const first = firstName(user?.name ?? "");
  const home = homeOf(role);

  const pending = useSyncExternalStore(
    subscribeTourPending,
    () => !!user && isTourPending(user.id),
    () => false,
  );
  // Ajustes asks for a replay by marking it and navigating home.
  const invite = pending && ready && pathname === home && phase === "idle";
  const dismiss = () => user && clearTourPending(user.id);

  useEffect(() => () => tour.current?.destroy(), []);

  const start = () => {
    dismiss();
    const present = steps.filter((s) => visibleTarget(s.target));
    if (present.length === 0) return setPhase("idle");
    setPhase("running");
    let finished = false;
    const instance = driver({
      steps: present.map((s) => ({
        element: () => visibleTarget(s.target)!,
        popover: { title: s.title, description: s.text },
      })),
      popoverClass: "vetify-tour",
      showProgress: true,
      progressText: "Paso {{current}} de {{total}}",
      nextBtnText: "Siguiente",
      prevBtnText: "Atrás",
      doneBtnText: "Terminar",
      overlayOpacity: 0.6,
      stagePadding: 6,
      stageRadius: 10,
      animate: !matchMedia("(prefers-reduced-motion: reduce)").matches,
      smoothScroll: true,
      onPopoverRender: (popover) => {
        popover.closeButton.textContent = "Saltar";
        popover.closeButton.setAttribute("aria-label", "Saltar el recorrido");
      },
      onNextClick: (_el, _step, { driver: d }) => {
        if (d.isLastStep()) {
          finished = true;
          d.destroy();
        } else d.moveNext();
      },
      onDestroyed: () => {
        tour.current = null;
        setPhase(finished ? "done" : "idle");
      },
    });
    tour.current = instance;
    instance.drive();
  };

  return (
    <>
      <Dialog open={invite} onOpenChange={(open) => !open && dismiss()}>
        <DialogContent showCloseButton={false} className="gap-3 p-6">
          <p className="etiqueta">Bienvenida</p>
          <DialogTitle className="font-display text-3xl leading-tight">
            {first}, te damos la bienvenida {role === "owner" ? "a Vetify" : "al portal"}.
          </DialogTitle>
          <DialogDescription className="text-base">
            Te mostramos lo esencial en unos pocos pasos. Podés saltarlo cuando quieras
            {role === "owner" && " y repetirlo desde Ajustes"}.
          </DialogDescription>
          <Button variant="solido" size="lg" className="mt-2 h-12" onClick={start}>
            Empezar recorrido
          </Button>
          <Button variant="ghost" onClick={dismiss}>
            Ahora no
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={phase === "done"} onOpenChange={(open) => !open && setPhase("idle")}>
        <DialogContent showCloseButton={false} className="gap-3 p-6">
          <DialogTitle className="font-display text-3xl leading-tight">
            Ya conocés Vetify, {first}.
          </DialogTitle>
          <DialogDescription className="text-base">
            {role === "owner"
              ? "Si querés repasarlo, está en Ajustes."
              : "Cuando tu clínica esté verificada te avisamos por correo."}
          </DialogDescription>
          <Button
            variant="solido"
            size="lg"
            className="mt-2 h-12"
            onClick={() => setPhase("idle")}
          >
            Empezar
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function OwnerTour() {
  const pets = usePets();
  const first = pets.data?.[0];
  return (
    <Tour
      role="owner"
      steps={tourSteps("owner", { petName: first?.name ?? null })}
      ready={pets.isSuccess}
    />
  );
}

export function ClinicTour() {
  const clinic = useMyClinic();
  return (
    <Tour
      role="clinic"
      steps={tourSteps("clinic", { petName: null })}
      ready={clinic.isSuccess}
    />
  );
}
