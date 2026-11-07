"use client";

import type { Clinic } from "@vetify/types";
import { useState } from "react";
import { Empty, LoadError, LoadingList } from "@/components/states";
import { ScreenTitle, StatusWord } from "@/components/system";
import { Button } from "@/components/ui/button";
import { useAdminClinics, useSetClinicVerified } from "@/hooks/useClinic";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";

const FILTERS = [
  { value: false, text: "Por verificar" },
  { value: true, text: "Verificadas" },
  { value: undefined, text: "Todas" },
] as const;

/**
 * Admins review each clinic before it can issue link codes. Verification is
 * done outside the app (legal id, vet registry); here it is recorded.
 */
export function ClinicReview() {
  const [verified, setVerified] = useState<boolean | undefined>(false);
  const clinics = useAdminClinics(verified);
  const setStatus = useSetClinicVerified();

  const toggle = (clinic: Clinic) => {
    const action = clinic.verified ? "quitarle la verificación a" : "verificar a";
    if (window.confirm(`¿Seguro que querés ${action} ${clinic.name}?`)) {
      setStatus.mutate({ clinicId: clinic.id, verified: !clinic.verified });
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <ScreenTitle
        label="Administración"
        title="Clínicas"
        description="Verificá cada clínica (cédula jurídica, colegiado del responsable) antes de habilitarla. Solo las verificadas pueden generar códigos de vinculación."
      />
      <fieldset className="flex flex-wrap gap-2 text-sm">
        <legend className="sr-only">Filtro</legend>
        {FILTERS.map((f) => (
          <button
            key={f.text}
            type="button"
            aria-pressed={verified === f.value}
            onClick={() => setVerified(f.value)}
            className="min-h-9 rounded-full border border-border px-3 text-muted-foreground aria-pressed:border-foreground aria-pressed:text-foreground"
          >
            {f.text}
          </button>
        ))}
      </fieldset>
      {setStatus.isError && (
        <p className="text-sm text-destructive">{errorMessage(setStatus.error)}</p>
      )}
      {clinics.isPending ? (
        <LoadingList />
      ) : clinics.error ? (
        <LoadError error={clinics.error} retry={() => void clinics.refetch()} />
      ) : clinics.data.length === 0 ? (
        <Empty title="No hay clínicas en esta lista." />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="etiqueta border-b border-filete text-left">
              <th className="py-2 font-normal">Clínica</th>
              <th className="hidden py-2 font-normal sm:table-cell">Registro</th>
              <th className="py-2 font-normal">Estado</th>
              <th className="py-2 text-right font-normal">Acción</th>
            </tr>
          </thead>
          <tbody>
            {clinics.data.map((clinic) => (
              <tr key={clinic.id} className="border-b border-border">
                <td className="py-3">
                  {clinic.name}
                  {clinic.address && (
                    <span className="block text-xs text-muted-foreground">
                      {clinic.address}
                    </span>
                  )}
                </td>
                <td className="hidden py-3 text-muted-foreground sm:table-cell">
                  {formatDate(clinic.createdAt)}
                </td>
                <td className="py-3">
                  <StatusWord action={!clinic.verified}>
                    {clinic.verified ? "Verificada" : "Pendiente"}
                  </StatusWord>
                </td>
                <td className="py-3 text-right">
                  <Button
                    size="sm"
                    variant={clinic.verified ? "outline" : "default"}
                    disabled={setStatus.isPending}
                    onClick={() => toggle(clinic)}
                  >
                    {clinic.verified ? "Quitar verificación" : "Verificar"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
