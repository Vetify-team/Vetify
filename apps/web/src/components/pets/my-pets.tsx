"use client";

import { Plus, QrCode } from "lucide-react";
import Link from "next/link";
import { Empty, LoadError, LoadingList } from "@/components/states";
import {
  Initial,
  Row,
  ScreenTitle,
  Section,
  StatusWord,
  VaccineStatusText,
} from "@/components/system";
import { buttonVariants } from "@/components/ui/button";
import { usePets } from "@/hooks/usePets";
import { useAlerts } from "@/hooks/useRecord";
import { useSession } from "@/hooks/useSession";
import { formatDate, greeting } from "@/lib/format";
import { alertLabel } from "@/lib/labels";
import { FREE_PLAN_LIMIT } from "@/lib/plans";
import { cn } from "cn";
import { describePet, summarizeAlerts } from "./pet-utils";

/** Owner's home: their pets, shortcuts and the next alert. */
export function MyPets() {
  const { user } = useSession();
  const pets = usePets();
  const alerts = useAlerts();
  const firstName = user?.name.split(" ")[0] ?? "";

  const alertsOf = (id: string) => alerts.data?.filter((a) => a.petId === id) ?? [];
  const upcoming = (alerts.data ?? [])
    .filter((a) => a.status !== "not_yet_due")
    .slice(0, 3);
  const first = pets.data?.[0];

  return (
    <div className="flex flex-col gap-8">
      <ScreenTitle
        label={`${greeting()}, ${firstName}`}
        title="Mis mascotas"
        action={
          <Link
            href="/mascotas/nueva"
            aria-label="Registrar mascota"
            className={cn(buttonVariants({ size: "icon-lg" }), "size-11 rounded-full")}
          >
            <Plus />
          </Link>
        }
      />

      {pets.isPending ? (
        <LoadingList />
      ) : pets.error ? (
        <LoadError error={pets.error} retry={() => void pets.refetch()} />
      ) : pets.data.length === 0 ? (
        <Empty title="Todavía no registraste ninguna mascota.">
          <p className="text-sm text-muted-foreground">
            Empezá su expediente: es tuyo y la acompaña a cualquier veterinaria.
          </p>
          <Link href="/mascotas/nueva" className={buttonVariants()}>
            Registrar mi primera mascota
          </Link>
        </Empty>
      ) : (
        <>
          <ul className="border-t border-filete">
            {pets.data.map((pet) => {
              const summary = summarizeAlerts(alertsOf(pet.id));
              return (
                <li key={pet.id}>
                  <Row
                    href={`/mascotas/${pet.id}`}
                    left={<Initial name={pet.name} />}
                    title={<span className="font-display text-xl">{pet.name}</span>}
                    detail={describePet(pet)}
                    right={
                      alerts.data && (
                        <StatusWord action={summary.action}>{summary.text}</StatusWord>
                      )
                    }
                  />
                </li>
              );
            })}
          </ul>

          {pets.data.length >= FREE_PLAN_LIMIT && (
            <p className="-mt-4 text-xs text-muted-foreground">
              El plan gratuito cubre {FREE_PLAN_LIMIT} mascotas. Premium las cubre todas.
            </p>
          )}

          {first && (
            <div className="grid grid-cols-2 gap-3">
              <Link href="/carne" className={buttonVariants()}>
                <QrCode /> Carné digital
              </Link>
              <Link
                href={`/mascotas/${first.id}/peso`}
                className={buttonVariants({ variant: "outline" })}
              >
                <Plus /> Registrar peso
              </Link>
            </div>
          )}
        </>
      )}

      {upcoming.length > 0 && (
        <Section title="Próximo aviso">
          {upcoming.map((a) => (
            <Row
              key={`${a.petId}-${a.kind}-${a.name}`}
              title={`${alertLabel(a)} de ${a.petName}`}
              detail={a.dueOn ? formatDate(a.dueOn) : "Sin aplicar"}
              right={<VaccineStatusText status={a.status} date={a.dueOn} />}
            />
          ))}
        </Section>
      )}
    </div>
  );
}
