"use client";

import { logInSchema } from "@vetify/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field, FormError } from "@/components/fields";
import { homeOf } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { errorMessage } from "@/lib/errors";
import { validateForm, type FieldErrors } from "@/lib/forms";

export function LoginForm() {
  const { login } = useSession();
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { data, errors } = validateForm(event.currentTarget, logInSchema);
    setErrors(errors ?? {});
    if (!data) return;
    login.mutate(data, {
      onSuccess: (session) => router.replace(homeOf(session.user.role)),
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <h1 className="titulo-seccion">Iniciar sesión</h1>
      <Field
        label="Correo"
        name="email"
        type="email"
        autoComplete="email"
        error={errors.email}
      />
      <Field
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        error={errors.password}
      />
      <FormError message={login.isError ? errorMessage(login.error) : null} />
      <Button type="submit" size="lg" disabled={login.isPending}>
        {login.isPending ? "Ingresando…" : "Ingresar"}
      </Button>
      <p className="text-sm text-muted-foreground">
        ¿No tenés cuenta?{" "}
        <Link href="/registro" className="text-primary underline underline-offset-4">
          Registrate
        </Link>
      </p>
    </form>
  );
}
