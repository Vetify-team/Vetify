"use client";

import { passwordSchema } from "@vetify/types";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { z } from "zod";
import { Field, FormError } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { api, ApiRequestError } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { validateForm, type FieldErrors } from "@/lib/forms";

const newPasswordSchema = z
  .object({ password: passwordSchema, passwordConfirm: z.string() })
  .refine((data) => data.password === data.passwordConfirm, {
    path: ["passwordConfirm"],
  });

// The token arrives in the #fragment (never sent to a server). The latest
// one is kept here, because the fragment is then removed from the URL.
let linkToken = "";
const readToken = () => {
  const fragment = decodeURIComponent(window.location.hash.slice(1));
  if (fragment) linkToken = fragment;
  return linkToken;
};
const onHashChange = (notify: () => void) => {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
};

/** Step 2 of the reset: the emailed link opens this page to set the new password. */
export function ResetPasswordForm() {
  const token = useSyncExternalStore(onHashChange, readToken, () => null);
  if (token === null) return null;
  // A new link opened in the same tab starts over.
  return <NewPasswordForm key={token} token={token} />;
}

function NewPasswordForm({ token }: { token: string }) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const reset = useMutation({
    mutationFn: (password: string) => api.resetPassword(token, password),
  });

  // Out of the address bar, history and screenshots once it is read.
  useEffect(() => {
    if (token) window.history.replaceState(null, "", window.location.pathname);
  }, [token]);

  const linkDead =
    !token ||
    (reset.error instanceof ApiRequestError &&
      reset.error.code === "RESET_TOKEN_INVALID");
  if (linkDead)
    return (
      <div className="flex flex-col gap-5" role="alert">
        <h1 className="titulo-seccion">El enlace no sirve</h1>
        <p className="text-muted-foreground">
          {token
            ? "El enlace venció o ya se usó. Por seguridad, cada enlace funciona una sola vez y por poco tiempo."
            : "Abrí esta página desde el enlace que te enviamos por correo."}
        </p>
        <Link
          href="/recuperar-contrasena"
          className="text-sm text-primary underline underline-offset-4"
        >
          Pedir un enlace nuevo
        </Link>
      </div>
    );

  if (reset.isSuccess)
    return (
      <div className="flex flex-col gap-5" role="status">
        <h1 className="titulo-seccion">Contraseña actualizada</h1>
        <p className="text-muted-foreground">
          Ya podés entrar con tu contraseña nueva. Por seguridad cerramos la sesión en
          todos tus dispositivos.
        </p>
        <Link
          href="/iniciar-sesion"
          className="text-sm text-primary underline underline-offset-4"
        >
          Iniciar sesión
        </Link>
      </div>
    );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { data, errors } = validateForm(event.currentTarget, newPasswordSchema);
    setErrors(errors ?? {});
    if (data) reset.mutate(data.password);
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <h1 className="titulo-seccion">Elegí una contraseña nueva</h1>
      <Field
        label="Contraseña nueva"
        name="password"
        type="password"
        autoComplete="new-password"
        error={errors.password}
        hint="Al menos 12 caracteres. Una frase larga es más segura que una palabra con símbolos."
      />
      <Field
        label="Repetí la contraseña"
        name="passwordConfirm"
        type="password"
        autoComplete="new-password"
        error={errors.passwordConfirm}
      />
      <FormError message={reset.isError ? errorMessage(reset.error) : null} />
      <Button type="submit" size="lg" disabled={reset.isPending}>
        {reset.isPending ? "Guardando…" : "Cambiar contraseña"}
      </Button>
    </form>
  );
}
