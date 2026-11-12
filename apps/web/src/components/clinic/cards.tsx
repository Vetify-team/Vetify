"use client";

import Link from "next/link";
import { Empty, LoadError, LoadingList } from "@/components/states";
import {
  Row,
  ScreenTitle,
  Section,
  StatusWord,
  VaccineStatusText,
} from "@/components/system";
import { useClinicCards } from "@/hooks/useClinic";
import { formatDate } from "@/lib/format";
import { speciesLabel } from "@/lib/labels";

/**
 * Vaccination cards of every patient that shared at least its card. A pet
 * shared as "solo carné" appears only here; the rest link to their record.
 */
export function ClinicCards() {
  const { data, error, isPending, refetch } = useClinicCards();
  const cardOnly = data?.filter((c) => !c.fullAccess).length ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <ScreenTitle
        label={
          data
            ? `${data.length} ${data.length === 1 ? "carné" : "carnés"} · ${cardOnly} solo carné`
            : "Vacunación"
        }
        title="Carnés"
        description="La vigencia de las vacunas de cada paciente. Si el dueño compartió solo el carné, es lo único que ves de esa mascota."
      />
      {isPending ? (
        <LoadingList />
      ) : error ? (
        <LoadError error={error} retry={() => void refetch()} />
      ) : data.length === 0 ? (
        <Empty title="Todavía no tenés carnés.">
          <p className="text-muted-foreground">
            Aparecen cuando un dueño escribe el código de tu clínica, con permiso completo
            o solo de carné.
          </p>
        </Empty>
      ) : (
        data.map((card) => (
          <Section
            key={card.petId}
            title={
              card.fullAccess ? (
                <Link
                  href={`/pacientes/${card.petId}`}
                  className="underline-offset-4 hover:underline"
                >
                  {card.name}
                </Link>
              ) : (
                card.name
              )
            }
            extra={
              <span className="flex items-center gap-3">
                {speciesLabel[card.species]}
                {!card.fullAccess && <StatusWord action={false}>Solo carné</StatusWord>}
              </span>
            }
          >
            {card.vaccines.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">
                Sin vacunas registradas.
              </p>
            ) : (
              card.vaccines.map((v) => (
                <Row
                  key={v.vaccine}
                  title={v.vaccine}
                  detail={`Aplicada ${formatDate(v.lastAppliedOn)} · vence ${formatDate(v.expiresOn)}`}
                  right={<VaccineStatusText status={v.status} date={v.expiresOn} />}
                />
              ))
            )}
          </Section>
        ))
      )}
    </div>
  );
}
