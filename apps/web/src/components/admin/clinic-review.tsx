"use client";

import { suspendClinicSchema, type Clinic } from "@vetify/types";
import { useState, type FormEvent } from "react";
import { FormError, TextArea } from "@/components/fields";
import { Empty, LoadError, LoadingList } from "@/components/states";
import { ScreenTitle, StatusWord } from "@/components/system";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useAdminClinics,
  useReinstateClinic,
  useSetClinicVerified,
  useSuspendClinic,
} from "@/hooks/useClinic";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { validateForm, type FieldErrors } from "@/lib/forms";

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
  const reinstate = useReinstateClinic();

  const lift = (clinic: Clinic) => {
    if (
      window.confirm(
        `¿Reactivar ${clinic.name}? Recupera el acceso a los expedientes que los dueños le habían dado.`,
      )
    ) {
      reinstate.mutate(clinic.id);
    }
  };

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
        description="Verificá cada clínica (cédula jurídica, colegiado del responsable) antes de habilitarla. Solo las verificadas pueden generar códigos de vinculación. Ante un abuso, suspendela: pierde el acceso a todo de inmediato."
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
      {(setStatus.isError || reinstate.isError) && (
        <p className="text-sm text-destructive">
          {errorMessage(setStatus.error ?? reinstate.error)}
        </p>
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
              <th className="py-2 text-right font-normal">Acciones</th>
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
                  {clinic.suspendedAt ? (
                    <>
                      <StatusWord action>Suspendida</StatusWord>
                      <span className="block text-xs text-muted-foreground">
                        desde {formatDate(clinic.suspendedAt)}
                      </span>
                    </>
                  ) : (
                    <StatusWord action={!clinic.verified}>
                      {clinic.verified ? "Verificada" : "Pendiente"}
                    </StatusWord>
                  )}
                </td>
                <td className="py-3">
                  <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
                    <Button
                      size="sm"
                      variant={clinic.verified ? "outline" : "default"}
                      disabled={setStatus.isPending}
                      onClick={() => toggle(clinic)}
                    >
                      {clinic.verified ? "Quitar verificación" : "Verificar"}
                    </Button>
                    {clinic.suspendedAt ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={reinstate.isPending}
                        onClick={() => lift(clinic)}
                      >
                        Reactivar
                      </Button>
                    ) : (
                      <SuspendClinic clinic={clinic} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/**
 * Emergency stop: the clinic loses every record at once and its staff is
 * logged out. The reason stays in the audit trail with who did it and when.
 */
function SuspendClinic({ clinic }: { clinic: Clinic }) {
  const suspend = useSuspendClinic();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const changeOpen = (next: boolean) => {
    if (suspend.isPending) return;
    setOpen(next);
    if (!next) {
      setErrors({});
      suspend.reset();
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { data, errors } = validateForm(event.currentTarget, suspendClinicSchema);
    setErrors(errors ?? {});
    if (!data) return;
    suspend.mutate(
      { clinicId: clinic.id, reason: data.reason },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button size="sm" variant="destructive" />}>
        Suspender
      </DialogTrigger>
      <DialogContent className="gap-6 rounded-lg p-6 text-left sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-medium">
            ¿Suspender {clinic.name}?
          </DialogTitle>
          <DialogDescription>
            Pierde ya el acceso a todos los expedientes y se cierra la sesión de todo su
            equipo, que no podrá volver a entrar. Los permisos de los dueños se guardan:
            al reactivarla, los recupera.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <TextArea
            label="Motivo"
            name="reason"
            rows={3}
            maxLength={500}
            hint="Queda registrado junto con tu usuario y la hora."
            error={errors.reason}
          />
          <FormError message={suspend.isError ? errorMessage(suspend.error) : null} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose
              render={<Button variant="outline" type="button" />}
              disabled={suspend.isPending}
            >
              Cancelar
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={suspend.isPending}>
              {suspend.isPending ? "Suspendiendo…" : "Suspender ahora"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
