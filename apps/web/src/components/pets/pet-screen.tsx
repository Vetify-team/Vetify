"use client";

import type { Pet } from "@vetify/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { LoadError, LoadingList } from "@/components/states";
import { ScreenTitle } from "@/components/system";
import { useCurrentPet } from "@/hooks/useCurrentPet";
import { usePet } from "@/hooks/usePets";
import { petLabel } from "./pet-utils";

/**
 * Frame of an owner's pet screen: loads the pet, remembers it as the current
 * one and renders the "LUNA · GOLDEN RETRIEVER / Title" header.
 */
export function PetScreen({
  id,
  title,
  description,
  action,
  back = { href: `/mascotas/${id}`, text: "Perfil" },
  children,
}: {
  id: string;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  back?: { href: string; text: string } | null;
  children: (pet: Pet) => ReactNode;
}) {
  const { data: pet, error, isPending, refetch } = usePet(id);
  const select = useCurrentPet((s) => s.select);

  useEffect(() => {
    if (pet) select(pet.id);
  }, [pet, select]);

  if (isPending) return <LoadingList rows={3} />;
  if (error) return <LoadError error={error} retry={() => void refetch()} />;

  return (
    <div className="flex flex-col gap-8">
      {back && (
        <Link
          href={back.href}
          className="-mb-4 flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> {back.text}
        </Link>
      )}
      {title && (
        <ScreenTitle
          label={petLabel(pet)}
          title={title}
          description={description}
          action={action}
        />
      )}
      {children(pet)}
    </div>
  );
}
