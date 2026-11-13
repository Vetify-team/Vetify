"use client";

import type { Alert, Pet } from "@vetify/types";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { OwnerPageSkeleton } from "@/components/owner/owner-page-skeleton";
import { LoadError } from "@/components/states";
import { buttonVariants } from "@/components/ui/button";
import { useBillingStatus } from "@/hooks/useBilling";
import { usePets } from "@/hooks/usePets";
import { useAlerts } from "@/hooks/useRecord";
import { useSession } from "@/hooks/useSession";
import { age, greeting } from "@/lib/format";
import { speciesLabel } from "@/lib/labels";
import { statusLine, type Tone } from "@/lib/pet-summary";
import { FREE_PLAN_LIMIT } from "@/lib/plans";
import { cn } from "cn";
import { avatarTone } from "./pet-utils";

/** "Perro · 5 años". */
const speciesAndAge = (pet: Pet) =>
  [speciesLabel[pet.species], age(pet.birthDate)].filter(Boolean).join(" · ");

/** Short words for the pill on the photo; the full line goes to screen readers. */
const PILL: Record<Tone, string> = {
  alert: "Vacuna vencida",
  warn: "Por vencer",
  ok: "Al día",
  muted: "Sin vacunas",
};
const PILL_TONE: Record<Tone, string> = {
  alert: "bg-alert text-white",
  warn: "bg-warn text-white",
  ok: "bg-ok text-white",
  muted: "bg-white/85 text-[#1d1b18]",
};

/**
 * A pet's card: the photo fills it (4:5), the name and species over a dark
 * gradient at the bottom, the vaccine status as a pill in the top corner.
 * Without a photo, the same card on a warm color with the initial large.
 */
function PetCard({ pet, alerts }: { pet: Pet; alerts: Alert[] }) {
  const status = statusLine(alerts);
  const [broken, setBroken] = useState(false);
  const photo = pet.photoUrl && !broken ? pet.photoUrl : null;
  return (
    <Link
      href={`/mascotas/${pet.id}`}
      className={cn(
        "group relative block aspect-[4/5] overflow-hidden rounded-3xl ring-1 ring-black/8 transition-transform outline-none hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-ring/60 dark:ring-white/10",
        !photo && avatarTone(pet.name),
      )}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL, already sized
        <img
          src={photo}
          alt=""
          onError={() => setBroken(true)}
          className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center pb-10 font-display text-[7rem] leading-none sm:text-[8rem]"
        >
          {pet.name.trim().charAt(0).toUpperCase()}
        </span>
      )}
      <span
        className={cn(
          "absolute top-2.5 right-2.5 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold shadow-sm sm:top-3 sm:right-3 sm:text-xs",
          PILL_TONE[status.tone],
        )}
      >
        <span aria-hidden>{PILL[status.tone]}</span>
        <span className="sr-only">{status.text}</span>
      </span>
      <span
        className={cn(
          "absolute inset-x-0 bottom-0 flex flex-col px-3.5 pb-3.5 sm:px-4 sm:pb-4",
          // On a photo, white over a dark gradient; on the warm color, ink.
          photo
            ? "bg-gradient-to-t from-black/75 via-black/40 to-transparent pt-16 text-white"
            : "pt-4",
        )}
      >
        <span className="truncate font-display text-2xl leading-tight font-medium sm:text-3xl">
          {pet.name}
        </span>
        <span
          className={cn(
            "truncate text-xs sm:text-sm",
            photo ? "text-white/85" : "opacity-75",
          )}
        >
          {speciesAndAge(pet)}
        </span>
      </span>
    </Link>
  );
}

/** Owner's home: a photo card per pet, and a clear way to add one. */
export function MyPets() {
  const { user } = useSession();
  const pets = usePets();
  const alerts = useAlerts();
  const billing = useBillingStatus();
  // The limit only applies while payments are on (and Premium can be bought).
  const capped = billing.data?.enabled === true && billing.data.plan === "free";
  const firstName = user?.name.split(" ")[0] ?? "";

  if (pets.isPending || alerts.isPending)
    return <OwnerPageSkeleton page="pets" petCount={pets.data?.length} />;

  const add = (
    <Link
      href="/mascotas/nueva"
      data-tour="add-pet"
      className={cn(buttonVariants({ variant: "solido", size: "lg" }), "rounded-full")}
    >
      <Plus aria-hidden /> Agregar mascota
    </Link>
  );

  return (
    <div data-wide className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {greeting()}
            {firstName && `, ${firstName}`}
          </p>
          <h1 className="font-display text-4xl leading-tight font-medium sm:text-5xl">
            Mis mascotas
          </h1>
        </div>
        {pets.data && pets.data.length > 0 && add}
      </header>

      {pets.error ? (
        <LoadError error={pets.error} retry={() => void pets.refetch()} />
      ) : pets.data.length === 0 ? (
        <div
          data-tour="pet-empty"
          className="flex flex-col items-start gap-4 rounded-3xl bg-card p-8 shadow-sm"
        >
          <p className="font-display text-3xl leading-tight">
            Todavía no registraste ninguna mascota.
          </p>
          <p className="max-w-prose text-muted-foreground">
            Empezá su expediente: es tuyo y la acompaña a cualquier veterinaria.
          </p>
          {add}
        </div>
      ) : (
        <>
          <ul
            data-tour="pet-list"
            className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4"
          >
            {pets.data.map((pet) => (
              <li key={pet.id}>
                <PetCard
                  pet={pet}
                  alerts={alerts.data?.filter((a) => a.petId === pet.id) ?? []}
                />
              </li>
            ))}
          </ul>
          {capped && pets.data.length >= FREE_PLAN_LIMIT && (
            <p className="-mt-2 text-sm text-muted-foreground">
              El plan gratuito cubre {FREE_PLAN_LIMIT} mascotas.{" "}
              <Link href="/ajustes" className="text-primary underline underline-offset-4">
                Premium las cubre todas
              </Link>
              .
            </p>
          )}
        </>
      )}
    </div>
  );
}
