"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Empty, LoadError, LoadingList } from "@/components/states";
import { buttonVariants } from "@/components/ui/button";
import { useCurrentPet } from "@/hooks/useCurrentPet";
import { usePets } from "@/hooks/usePets";

/**
 * The "Esquema" and "Carné" tabs belong to a pet: they open the last one the
 * owner viewed, or the first if none yet.
 */
export function GoToPet({ section }: { section: "vacunas" | "carne" }) {
  const { data, error, isPending, refetch } = usePets();
  const current = useCurrentPet((s) => s.id);
  const router = useRouter();
  const target = data?.find((p) => p.id === current) ?? data?.[0];

  useEffect(() => {
    if (target) router.replace(`/mascotas/${target.id}/${section}`);
  }, [target, section, router]);

  if (error) return <LoadError error={error} retry={() => void refetch()} />;
  if (isPending || target) return <LoadingList rows={3} />;
  return (
    <Empty title="Primero registrá una mascota.">
      <Link href="/mascotas/nueva" className={buttonVariants()}>
        Registrar mascota
      </Link>
    </Empty>
  );
}
