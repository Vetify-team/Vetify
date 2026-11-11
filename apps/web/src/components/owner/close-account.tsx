"use client";

import { deleteAccountSchema } from "@vetify/types";
import { useState, type FormEvent } from "react";
import { Field, FormError } from "@/components/fields";
import { Section } from "@/components/system";
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
import { useSession } from "@/hooks/useSession";
import { markAccountClosed } from "@/lib/account-closed";
import { errorMessage } from "@/lib/errors";
import { validateForm, type FieldErrors } from "@/lib/forms";

/**
 * Closing the account erases everything for good, so it asks twice: an
 * explicit acknowledgement and the current password (checked by the API).
 */
export function CloseAccount() {
  const { deleteAccount } = useSession();
  const [open, setOpen] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const changeOpen = (next: boolean) => {
    if (deleteAccount.isPending) return;
    setOpen(next);
    if (!next) {
      setUnderstood(false);
      setErrors({});
      deleteAccount.reset();
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { data, errors } = validateForm(event.currentTarget, deleteAccountSchema);
    setErrors(errors ?? {});
    if (!data || !understood) return;
    // Not mutate's onSuccess: clearing the session unmounts this page (the
    // protected route redirects), and unmounted mutate callbacks never run.
    // A full load wins over that redirect and drops whatever the tab held.
    deleteAccount
      .mutateAsync(data.password)
      .then(() => {
        markAccountClosed();
        window.location.replace("/iniciar-sesion");
      })
      .catch(() => {
        // Shown from deleteAccount.error.
      });
  };

  return (
    <Section title="Cerrar cuenta">
      <div className="flex flex-col items-start gap-4 pt-4">
        <p className="text-sm text-muted-foreground">
          Borra tu cuenta, tus mascotas y todo su expediente, los permisos que diste a
          clínicas, tus avisos y tus pagos. No se puede deshacer.
        </p>
        <Dialog open={open} onOpenChange={changeOpen}>
          <DialogTrigger render={<Button variant="destructive" />}>
            Cerrar mi cuenta
          </DialogTrigger>
          <DialogContent className="gap-6 rounded-lg p-6 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl font-medium">
                ¿Cerrar tu cuenta?
              </DialogTitle>
              <DialogDescription>
                Vamos a borrar para siempre tu cuenta, tus mascotas con todo su expediente
                (consultas, vacunas, desparasitaciones, tratamientos, exámenes, pesos y
                notas), los permisos de las clínicas, tus avisos y tus pagos. Las clínicas
                dejan de ver a tus mascotas. Te mandamos un correo de confirmación.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} noValidate className="flex flex-col gap-5">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  name="understood"
                  checked={understood}
                  onChange={(event) => setUnderstood(event.target.checked)}
                  className="mt-0.5 size-4 accent-destructive"
                />
                Entiendo que se borra todo y que no se puede deshacer.
              </label>
              <Field
                label="Tu contraseña actual"
                name="password"
                type="password"
                autoComplete="current-password"
                error={errors.password}
              />
              <FormError
                message={deleteAccount.isError ? errorMessage(deleteAccount.error) : null}
              />
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <DialogClose
                  render={<Button variant="outline" type="button" />}
                  disabled={deleteAccount.isPending}
                >
                  Cancelar
                </DialogClose>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={!understood || deleteAccount.isPending}
                >
                  {deleteAccount.isPending ? "Borrando…" : "Borrar todo y cerrar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Section>
  );
}
