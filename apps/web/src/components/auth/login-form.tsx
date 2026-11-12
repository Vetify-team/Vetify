"use client";

import { logInSchema } from "@vetify/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Field, FormError } from "@/components/fields";
import { goHome } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { takeAccountClosed } from "@/lib/account-closed";
import { errorMessage } from "@/lib/errors";
import { validateForm, type FieldErrors } from "@/lib/forms";

export function LoginForm() {
  const { login } = useSession();
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  // Set by Ajustes → Cerrar cuenta just before it reloads to this page.
  const [accountClosed, setAccountClosed] = useState(false);
  useEffect(() => {
    if (takeAccountClosed()) queueMicrotask(() => setAccountClosed(true));
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { data, errors } = validateForm(event.currentTarget, logInSchema);
    setErrors(errors ?? {});
    if (!data) return;
    login.mutate(data, {
      onSuccess: (session) => goHome(router, session.user.role),
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <h1 className="titulo-seccion">Iniciar sesión</h1>
      {accountClosed && (
        <p role="status" className="border-l-2 border-primary py-1 pl-3 text-sm">
          Cerraste tu cuenta y borramos tus datos. Te mandamos un correo de confirmación.
        </p>
      )}
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
      <Link
        href="/recuperar-contrasena"
        className="-mt-2 self-end text-sm text-primary underline underline-offset-4"
      >
        ¿Olvidaste tu contraseña?
      </Link>
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
