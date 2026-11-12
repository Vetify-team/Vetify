import type { api } from "@/lib/api-client";
import type { VaccinationStatus } from "@vetify/types";
import type { ReactNode } from "react";
import { Row, ScreenTitle, Section } from "@/components/system";
import { FREE_PLAN_LIMIT } from "@/lib/plans";
import { recordedVaccines } from "@/lib/vaccination";
import { Skeleton } from "@/components/ui/skeleton";

export type OwnerSkeletonPage = "pets" | "schedule" | "card" | "alerts" | "settings";

export function ownerSkeletonForPath(path: string): OwnerSkeletonPage {
  if (path === "/esquema" || path.endsWith("/vacunas")) return "schedule";
  if (path === "/carne" || path.endsWith("/carne")) return "card";
  if (path.startsWith("/avisos")) return "alerts";
  if (path.startsWith("/ajustes")) return "settings";
  return "pets";
}

/** Keep the real text's dimensions while showing only an animated placeholder. */
function Ghost({ children }: { children: ReactNode }) {
  return (
    <span className="relative inline-block max-w-full align-baseline">
      <span className="invisible">{children}</span>
      <span
        aria-hidden="true"
        className="absolute inset-0 animate-pulse rounded-sm"
        style={{
          background:
            "repeating-linear-gradient(to bottom, transparent 0, transparent 0.2em, var(--muted) 0.2em, var(--muted) 0.85em, transparent 0.85em, transparent 1.4em)",
        }}
      />
    </span>
  );
}

/** Reuse the real row and section spacing so placeholders occupy the same slots. */
export function TextRowsSkeleton({
  rows = 1,
  section = false,
}: {
  rows?: number;
  section?: boolean;
}) {
  const content = Array.from({ length: rows }, (_, i) => (
    <Row
      key={i}
      title={<Skeleton className="h-4 w-36 max-w-full" />}
      detail={<Skeleton className="h-3 w-24 max-w-full" />}
      right={<Skeleton className="h-3 w-14 shrink-0" />}
    />
  ));
  return (
    <div role="status" aria-label="Cargando contenido">
      {section ? (
        <Section
          title={
            <span className="inline-block h-4 w-28 animate-pulse rounded-md bg-muted" />
          }
        >
          {content}
        </Section>
      ) : (
        content
      )}
    </div>
  );
}

export function PetRowsSkeleton({ rows = 1 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Cargando mascotas" className="border-t border-filete">
      {Array.from({ length: rows }, (_, index) => (
        <Row
          key={index}
          left={<Skeleton className="size-12 shrink-0 rounded-none" />}
          title={<Skeleton className="h-5 w-24 max-w-full" />}
          detail={<Skeleton className="h-3 w-32 max-w-full" />}
          right={<Skeleton className="h-3 w-14 shrink-0" />}
        />
      ))}
    </div>
  );
}

function AccountSkeleton() {
  return (
    <Section title={<Ghost>Cuenta</Ghost>}>
      {["Nombre", "Correo", "Plan"].map((label) => (
        <Row
          key={label}
          title={<Ghost>{label}</Ghost>}
          right={<Skeleton className="h-3 w-28" />}
        />
      ))}
    </Section>
  );
}

export function OwnerPageSkeleton({
  page,
  hasQr = false,
  petCount,
  upcomingCount,
  schedule,
  hasCalendar,
  alertData,
  notifications,
  hasMicrochip,
}: {
  page: OwnerSkeletonPage;
  hasQr?: boolean;
  petCount?: number;
  upcomingCount?: number;
  schedule?: VaccinationStatus;
  hasCalendar?: boolean;
  alertData?: Awaited<ReturnType<typeof api.alerts>>;
  notifications?: Awaited<ReturnType<typeof api.notifications>>;
  hasMicrochip?: boolean;
}) {
  if (page === "card")
    return (
      <div className="flex flex-col gap-8" role="status" aria-label="Cargando carné">
        <article className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5">
          <div className="flex items-baseline justify-between">
            <span className="etiqueta">
              <Ghost>Carné de vacunación</Ghost>
            </span>
            <span className="font-display text-lg text-primary">
              <Ghost>Vetify</Ghost>
            </span>
          </div>
          <div className="flex flex-col items-center gap-3 text-center">
            {hasQr && <Skeleton className="size-[200px] shrink-0" />}
            <p className="text-sm">
              <Ghost>
                {hasQr
                  ? "Cualquier persona con este QR puede ver el nombre y estado de vacunas de tu mascota."
                  : "Creá un QR para compartir el estado de vacunación de tu mascota."}
              </Ghost>
            </p>
            {hasQr && (
              <span className="text-sm">
                <Ghost>Descargar QR</Ghost>
              </span>
            )}
            <Skeleton className="h-10 w-28" />
            {hasQr && (
              <>
                <Skeleton className="h-10 w-32" />
                <p className="text-xs">
                  <Ghost>
                    Al reemplazar o desactivar el QR, los anteriores dejan de funcionar.
                  </Ghost>
                </p>
              </>
            )}
          </div>
          <div className="flex items-center gap-4 border-t border-border pt-5">
            <Skeleton className="size-12 shrink-0 rounded-none" />
            <div className="flex flex-col gap-1">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <div className="text-sm">
            {Array.from(
              {
                length: schedule
                  ? schedule.vaccines.filter((item) => item.lastAppliedOn).length +
                    schedule.dewormings.filter((item) => item.nextDueOn).length +
                    (hasMicrochip ? 1 : 0)
                  : 1,
              },
              (_, index) => (
                <div key={index} className="fila flex items-center justify-between gap-3">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-32" />
                </div>
              ),
            )}
          </div>
        </article>
        <p className="text-center text-xs text-muted-foreground">
          <Ghost>
            Hospedajes, guarderías y aerolíneas confirman la vigencia sin ver el
            expediente completo.
          </Ghost>
        </p>
      </div>
    );

  if (page === "pets")
    return (
      <div className="flex flex-col gap-8">
        <ScreenTitle
          label={
            <span className="inline-block h-3 w-28 animate-pulse rounded-md bg-muted" />
          }
          title={<Ghost>Mis mascotas</Ghost>}
          action={<Skeleton className="size-11 shrink-0 rounded-full" />}
        />
        {petCount === 0 ? (
          <div className="flex flex-col items-start gap-3 py-8">
            <Skeleton className="h-7 w-64 max-w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-10 w-48" />
          </div>
        ) : (
          <>
            <PetRowsSkeleton rows={petCount ?? 1} />
            {petCount !== undefined && petCount >= FREE_PLAN_LIMIT && (
              <Skeleton className="-mt-4 h-3 w-full" />
            )}
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          </>
        )}
        {(upcomingCount === undefined || upcomingCount > 0) && (
          <TextRowsSkeleton rows={upcomingCount ?? 1} section />
        )}
      </div>
    );

  if (page === "schedule") {
    const entries = schedule
      ? [...recordedVaccines(schedule), ...schedule.dewormings]
      : undefined;
    const action =
      entries?.filter(({ status }) => status === "expired" || status === "expiring")
        .length ?? 0;
    const valid = entries?.filter(({ status }) => status === "valid").length ?? 0;
    return (
      <div className="flex flex-col gap-8">
        <div className="-mb-4 h-5">
          <Skeleton className="h-4 w-16" />
        </div>
        <ScreenTitle
          label={
            <span className="inline-block h-3 w-28 animate-pulse rounded-md bg-muted" />
          }
          title={<Ghost>Vacunación y desparasitación</Ghost>}
          description={
            <Ghost>
              Lo que registró la clínica. La vigencia de cada dosis sigue el esquema de
              Costa Rica.
            </Ghost>
          }
        />
        {!entries ? (
          <TextRowsSkeleton rows={3} section />
        ) : entries.length === 0 ? (
          <div className="flex flex-col gap-3 py-8">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-1/2" />
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {action > 0 && <TextRowsSkeleton rows={action} section />}
            {valid > 0 && <TextRowsSkeleton rows={valid} section />}
            {hasCalendar && <Skeleton className="h-10 w-full" />}
          </div>
        )}
      </div>
    );
  }

  if (page === "alerts") {
    const action = alertData?.filter(
      (item) =>
        item.status === "expired" || item.status === "due" || item.status === "expiring",
    ).length;
    const upcoming = alertData?.filter(
      (item) => item.status === "valid" || item.status === "not_yet_due",
    ).length;
    return (
      <div className="flex flex-col gap-8">
        <ScreenTitle
          label={<Ghost>Recordatorios</Ghost>}
          title={<Ghost>Avisos</Ghost>}
          description={
            <Ghost>
              Calculados con el esquema de vacunación de Costa Rica y lo que registró cada
              clínica.
            </Ghost>
          }
        />
        <Section title={<Ghost>Notificaciones</Ghost>}>
          {notifications === undefined ? (
            <div className="py-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-5 w-32" />
            </div>
          ) : notifications.length === 0 ? (
            <p className="text-sm">
              <Ghost>Todavía no tenés notificaciones.</Ghost>
            </p>
          ) : (
            notifications.map((item) => (
              <div key={item.id} className="border-b border-border py-3">
                <div className="h-6">
                  <Skeleton className="h-4 w-48" />
                </div>
                <div className="h-5">
                  <Skeleton className="h-3 w-32" />
                </div>
                {!item.readAt && (
                  <div className="h-5">
                    <Skeleton className="h-3 w-28" />
                  </div>
                )}
              </div>
            ))
          )}
        </Section>
        {!alertData ? (
          <TextRowsSkeleton rows={3} section />
        ) : alertData.length === 0 ? (
          <div className="flex flex-col items-start gap-3 py-8">
            <p className="font-display text-2xl">
              <Ghost>Nada pendiente.</Ghost>
            </p>
            <p className="text-sm">
              <Ghost>Cuando una vacuna se acerque a su vencimiento, aparece acá.</Ghost>
            </p>
          </div>
        ) : (
          <>
            {!!action && <TextRowsSkeleton rows={action} section />}
            {!!upcoming && <TextRowsSkeleton rows={upcoming} section />}
            {alertData.some((item) => item.dueOn) && <Skeleton className="h-10 w-full" />}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <ScreenTitle label={<Ghost>Tu cuenta</Ghost>} title={<Ghost>Ajustes</Ghost>} />
      <AccountSkeleton />
      <Section title={<Ghost>Ayuda</Ghost>}>
        <div className="pt-4">
          <Skeleton className="h-9 w-48" />
        </div>
      </Section>
      <Section title={<Ghost>Notificaciones al teléfono</Ghost>}>
        <div className="flex flex-col items-start gap-3 pt-4">
          <p className="text-sm text-muted-foreground">
            <Ghost>
              Recibí recordatorios de vacunas y desparasitación. El aviso no muestra datos
              de tu mascota en la pantalla bloqueada.
            </Ghost>
          </p>
          <Skeleton className="h-4 w-48" />
        </div>
      </Section>
      <Section title={<Ghost>Apariencia</Ghost>}>
        <div className="flex gap-2 pt-4">
          <Skeleton className="h-10 w-36 rounded-full" />
          <Skeleton className="h-10 w-20 rounded-full" />
          <Skeleton className="h-10 w-20 rounded-full" />
        </div>
      </Section>
    </div>
  );
}
