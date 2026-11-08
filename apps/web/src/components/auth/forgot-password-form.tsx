"use client";

import { forgotPasswordSchema, PASSWORD_RESET_MINUTES } from "@vetify/types";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Field, FormError } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { validateForm, type FieldErrors } from "@/lib/forms";

/**
 * Step 1 of the reset: ask for the link. The answer is the same whether or
 * not the email has an account, so the screen never reveals who uses Vetify.
 */
export function ForgotPasswordForm() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sentTo, setSentTo] = useState<string | null>(null);
  const forgot = useMutation({
    mutationFn: (email: string) => api.forgotPassword(email),
    onSuccess: (_, email) => setSentTo(email),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { data, errors } = validateForm(event.currentTarget, forgotPasswordSchema);
    setErrors(errors ?? {});
    if (data) forgot.mutate(data.email);
  };

  if (sentTo)
    return (
      <div className="flex flex-col gap-5" role="status">
        <h1 className="titulo-seccion">Revisá tu correo</h1>
        <p className="text-muted-foreground">
          Si <strong className="text-foreground">{sentTo}</strong> tiene una cuenta en
          Vetify, te enviamos un enlace para elegir una contraseña nueva. Vence en{" "}
          {PASSWORD_RESET_MINUTES} minutos y sirve una sola vez.
        </p>
        <p className="text-sm text-muted-foreground">
          ¿No llegó? Revisá la carpeta de spam o esperá un minuto y pedilo de nuevo.
        </p>
        <Button variant="outline" size="lg" onClick={() => setSentTo(null)}>
          Usar otro correo
        </Button>
        <Link
          href="/iniciar-sesion"
          className="text-sm text-primary underline underline-offset-4"
        >
          Volver a iniciar sesión
        </Link>
      </div>
    );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <h1 className="titulo-seccion">Recuperar contraseña</h1>
      <p className="text-sm text-muted-foreground">
        Escribí el correo de tu cuenta y te enviamos un enlace para elegir una contraseña
        nueva.
      </p>
      <Field
        label="Correo"
        name="email"
        type="email"
        autoComplete="email"
        error={errors.email}
      />
      <FormError message={forgot.isError ? errorMessage(forgot.error) : null} />
      <Button type="submit" size="lg" disabled={forgot.isPending}>
        {forgot.isPending ? "Enviando…" : "Enviar enlace"}
      </Button>
      <Link
        href="/iniciar-sesion"
        className="text-sm text-primary underline underline-offset-4"
      >
        Volver a iniciar sesión
      </Link>
    </form>
  );
}
