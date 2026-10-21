"use client";

import { signUpSchema, type SignUpRole } from "@vetify/types";
import { Building2, PawPrint } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field, FormError } from "@/components/fields";
import { homeOf } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { errorMessage } from "@/lib/errors";
import { apiFieldErrors, validateForm, type FieldErrors } from "@/lib/forms";

const ROLES: { role: SignUpRole; text: string; icon: typeof PawPrint }[] = [
  { role: "owner", text: "Tengo mascotas", icon: PawPrint },
  { role: "clinic", text: "Soy una clínica", icon: Building2 },
];

export function RegisterForm() {
  const { register } = useSession();
  const router = useRouter();
  const [role, setRole] = useState<SignUpRole>("owner");
  const [errors, setErrors] = useState<FieldErrors>({});

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { data, errors } = validateForm(event.currentTarget, signUpSchema, (d) => ({
      ...d,
      role,
    }));
    setErrors(errors ?? {});
    if (!data) return;
    register.mutate(data, {
      onSuccess: (session) => router.replace(homeOf(session.user.role)),
      onError: (error) => setErrors(apiFieldErrors(error)),
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <h1 className="titulo-seccion">Crear cuenta</h1>

      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="sr-only">Tipo de cuenta</legend>
        {ROLES.map(({ role: option, text, icon: Icon }) => (
          <button
            key={option}
            type="button"
            aria-pressed={role === option}
            onClick={() => setRole(option)}
            className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-border px-2 text-sm text-muted-foreground transition-colors aria-pressed:border-foreground aria-pressed:text-foreground"
          >
            <Icon className="size-4" aria-hidden /> {text}
          </button>
        ))}
      </fieldset>

      {role === "clinic" && (
        <>
          <Field
            label="Nombre de la clínica"
            name="clinicName"
            error={errors.clinicName}
          />
          <p className="-mt-2 text-xs text-muted-foreground">
            Vetify revisa cada clínica antes de que pueda recibir expedientes. Te avisamos
            cuando esté verificada.
          </p>
        </>
      )}
      <Field
        label={role === "clinic" ? "Tu nombre (responsable)" : "Nombre"}
        name="name"
        autoComplete="name"
        error={errors.name}
      />
      <Field
        label="Correo"
        name="email"
        type="email"
        autoComplete="email"
        error={errors.email}
      />
      <Field
        label="Teléfono (opcional)"
        name="phone"
        type="tel"
        autoComplete="tel"
        error={errors.phone}
      />
      <Field
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        error={errors.password}
        hint="Al menos 12 caracteres. Una frase larga es más segura que una palabra con símbolos."
      />
      <FormError message={register.isError ? errorMessage(register.error) : null} />
      <Button type="submit" size="lg" disabled={register.isPending}>
        {register.isPending ? "Creando cuenta…" : "Crear cuenta"}
      </Button>
      <p className="text-sm text-muted-foreground">
        ¿Ya tenés cuenta?{" "}
        <Link
          href="/iniciar-sesion"
          className="text-primary underline underline-offset-4"
        >
          Iniciá sesión
        </Link>
      </p>
    </form>
  );
}
