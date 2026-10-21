"use client";

import { LoadingList } from "@/components/states";
import {
  Initial,
  Label,
  Row,
  Section,
  StatusWord,
  VaccineStatusText,
} from "@/components/system";
import { useAlerts } from "@/hooks/useRecord";
import { dewormingLabel, formatDate, speciesLabel } from "@/lib/format";
import { describePet, summarizeAlerts } from "./pet-utils";
import { PetScreen } from "./pet-screen";

/** The pet's profile: its data and the doors to each part of the record. */
export function PetProfile({ id }: { id: string }) {
  const alerts = useAlerts();

  return (
    <PetScreen id={id} back={{ href: "/mascotas", text: "Mis mascotas" }}>
      {(pet) => {
        const own = alerts.data?.filter((a) => a.petId === pet.id) ?? [];
        const summary = summarizeAlerts(own);
        const attention = own
          .filter((a) => a.status !== "valid" && a.status !== "not_yet_due")
          .slice(0, 3);
        const data = [
          ["Especie", speciesLabel[pet.species]],
          ["Raza", pet.breed],
          ["Sexo", pet.sex === "male" ? "Macho" : pet.sex === "female" ? "Hembra" : null],
          ["Nacimiento", pet.birthDate ? formatDate(pet.birthDate) : null],
          ["Esterilizado", pet.neutered ? "Sí" : "No"],
          ["Microchip", pet.microchip],
        ].filter((d): d is [string, string] => !!d[1]);

        return (
          <>
            <header className="flex items-center gap-5">
              <Initial name={pet.name} large />
              <div className="min-w-0">
                <Label>Perfil</Label>
                <h1 className="font-display text-4xl font-medium">{pet.name}</h1>
                <p className="text-sm text-muted-foreground">{describePet(pet)}</p>
              </div>
            </header>

            <Section title="Expediente">
              <Row
                href={`/mascotas/${pet.id}/expediente`}
                title="Historial completo"
                detail="Consultas, vacunas, tratamientos y observaciones"
              />
              <Row
                href={`/mascotas/${pet.id}/vacunas`}
                title="Vacunación y desparasitación"
                detail="Esquema según especie, edad y país"
                right={
                  alerts.data && (
                    <StatusWord action={summary.action}>{summary.text}</StatusWord>
                  )
                }
              />
              <Row
                href={`/mascotas/${pet.id}/peso`}
                title="Serie de peso"
                detail="Evolución y registro de hoy"
              />
              <Row
                href={`/mascotas/${pet.id}/carne`}
                title="Carné digital"
                detail="Vigencia de vacunas para terceros"
              />
              <Row
                href={`/mascotas/${pet.id}/permisos`}
                title="Quién puede verlo"
                detail="Clínicas con acceso y bitácora"
              />
            </Section>

            {alerts.isPending ? (
              <LoadingList rows={1} />
            ) : (
              attention.length > 0 && (
                <Section title="Requiere atención">
                  {attention.map((a) => (
                    <Row
                      key={`${a.kind}-${a.name}`}
                      title={a.kind === "deworming" ? dewormingLabel(a.name) : a.name}
                      detail={a.dueOn ? formatDate(a.dueOn) : "Sin aplicar"}
                      right={<VaccineStatusText status={a.status} date={a.dueOn} />}
                    />
                  ))}
                </Section>
              )
            )}

            <Section title="Datos">
              <dl>
                {data.map(([key, value]) => (
                  <div key={key} className="fila flex justify-between gap-4 text-sm">
                    <dt className="text-muted-foreground">{key}</dt>
                    <dd className={key === "Microchip" ? "font-mono" : undefined}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </Section>
          </>
        );
      }}
    </PetScreen>
  );
}
