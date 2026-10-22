"use client";

import type { SignUpRole } from "@vetify/types";
import { ChevronLeft } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { progressOf, sectionLabels, type StepId } from "@/lib/onboarding";

/**
 * Frame of every wizard step: the three-part progress bar, "Atrás" and the
 * entrance animation. Each step remounts under its own key, so it animates in
 * (only when the user allows motion).
 */
export function WizardShell({
  role,
  step,
  onBack,
  children,
}: {
  role: SignUpRole;
  step: StepId;
  onBack: (() => void) | null;
  children: ReactNode;
}) {
  const { section, fills } = progressOf(role, step);

  return (
    <>
      {section !== null && (
        <div className="px-5 pt-3">
          <div className="flex min-h-11 items-center gap-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Atrás"
                className="-ml-2.5 flex size-11 items-center justify-center rounded-full text-foreground hover:bg-muted"
              >
                <ChevronLeft className="size-5" strokeWidth={1.5} aria-hidden />
              </button>
            )}
            <span className="etiqueta flex-1">{sectionLabels(role)[section]}</span>
            <span className="text-xs text-muted-foreground">{section + 1} de 3</span>
          </div>
          <div
            role="progressbar"
            aria-label="Progreso del registro"
            aria-valuemin={1}
            aria-valuemax={3}
            aria-valuenow={section + 1}
            className="mt-2.5 grid grid-cols-3 gap-1.5"
          >
            {fills.map((fill, i) => (
              <div key={i} className="h-[3px] overflow-hidden rounded-full bg-border">
                <div
                  className="h-full origin-left bg-primary transition-transform duration-500 ease-out motion-reduce:transition-none"
                  style={{ transform: `scaleX(${fill})` }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
      <div
        key={step}
        className="flex flex-1 flex-col px-6 pt-7 pb-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-300"
      >
        {children}
      </div>
    </>
  );
}

/** The step's buttons, pinned to the bottom of the screen. */
export function StepActions({ children }: { children: ReactNode }) {
  return <div className="mt-auto flex flex-col gap-2.5 pt-8">{children}</div>;
}

/** Primary action of a step: solid, full width, thumb-sized. */
export const primaryAction = "h-13 w-full text-base";

/** The large underlined input of the one-question steps (name, pet name). */
export const bigInput =
  "h-14 w-full border-0 border-b-[1.5px] border-primary bg-transparent p-0 font-display text-3xl text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:border-b-2";

/**
 * The step's question. Takes focus when the step appears so screen readers
 * announce the new step and keyboard users start from the top.
 */
export function StepTitle({
  children,
  description,
}: {
  children: ReactNode;
  description?: ReactNode;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div>
      <h2
        ref={ref}
        tabIndex={-1}
        className="font-display text-[2.35rem] leading-[1.05] font-medium outline-none"
      >
        {children}
      </h2>
      {description && <p className="mt-2.5 text-muted-foreground">{description}</p>}
    </div>
  );
}
