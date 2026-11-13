"use client";

import type { Alert, Pet } from "@vetify/types";
import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { PetAvatar } from "./pet-photo";
import { avatarTone } from "./pet-utils";

/** "Perro · 5 años". */
const speciesAndAge = (pet: Pet) =>
  [speciesLabel[pet.species], age(pet.birthDate)].filter(Boolean).join(" · ");

const DOT: Record<Tone, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  alert: "bg-alert",
  muted: "bg-muted-foreground/50",
};
const TEXT: Record<Tone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  alert: "text-alert",
  muted: "text-muted-foreground",
};

/** The pet's one status line: a colored dot and its words. */
function Status({ alerts }: { alerts: Alert[] }) {
  const { text, tone } = statusLine(alerts);
  return (
    <p
      className={cn(
        "flex items-baseline gap-2 text-sm leading-snug font-medium",
        TEXT[tone],
      )}
    >
      <span
        aria-hidden
        className={cn("size-2 shrink-0 translate-y-[-1px] rounded-full", DOT[tone])}
      />
      <span>{text}</span>
    </p>
  );
}

const cardShell =
  "group rounded-3xl bg-card shadow-[0_1px_2px_rgba(29,27,24,0.06),0_8px_24px_rgba(29,27,24,0.06)] transition-all outline-none hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(29,27,24,0.08),0_14px_32px_rgba(29,27,24,0.1)] focus-visible:ring-3 focus-visible:ring-ring/50 dark:shadow-none dark:ring-1 dark:ring-border";

/** Variant A: the photo (or initial) fills the top of the card. */
function TallCard({ pet, alerts }: { pet: Pet; alerts: Alert[] }) {
  return (
    <Link
      href={`/mascotas/${pet.id}`}
      className={cn(cardShell, "flex h-full flex-col overflow-hidden")}
    >
      <div
        className={cn(
          "flex aspect-[4/3] items-center justify-center overflow-hidden",
          !pet.photoUrl && avatarTone(pet.name),
        )}
      >
        {pet.photoUrl ? (
          <PetAvatar
            pet={pet}
            size="xl"
            className="size-full rounded-none sm:size-full"
          />
        ) : (
          <span aria-hidden className="font-display text-8xl leading-none">
            {pet.name.trim().charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5 px-5 pt-4 pb-5">
        <h2 className="truncate font-display text-3xl leading-tight font-medium">
          {pet.name}
        </h2>
        <p className="text-sm text-muted-foreground">{speciesAndAge(pet)}</p>
        <div className="mt-2">
          <Status alerts={alerts} />
        </div>
      </div>
    </Link>
  );
}

/** Variant B: a row card, photo on the left. */
function WideCard({ pet, alerts }: { pet: Pet; alerts: Alert[] }) {
  return (
    <Link
      href={`/mascotas/${pet.id}`}
      className={cn(cardShell, "flex items-center gap-5 p-4 sm:p-5")}
    >
      <PetAvatar pet={pet} size="lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="truncate font-display text-3xl leading-tight font-medium">
          {pet.name}
        </h2>
        <p className="text-sm text-muted-foreground">{speciesAndAge(pet)}</p>
        <div className="mt-1.5">
          <Status alerts={alerts} />
        </div>
      </div>
      <ChevronRight
        aria-hidden
        className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
      />
    </Link>
  );
}

/** Owner's home: a calm card per pet, one status line each, and a clear way to add one. */
export function MyPets() {
  const { user } = useSession();
  const pets = usePets();
  const alerts = useAlerts();
  const billing = useBillingStatus();
  // Temporary, to compare the two card designs; one stays.
  const tall = useSearchParams().get("variante") !== "b";
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
  const Card = tall ? TallCard : WideCard;

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
            className={cn(
              "grid gap-5",
              tall
                ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                : "grid-cols-1 lg:grid-cols-2",
            )}
          >
            {pets.data.map((pet) => (
              <li key={pet.id}>
                <Card
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
