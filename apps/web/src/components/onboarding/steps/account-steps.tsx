"use client";

import { signUpSchema, type SignUpRole } from "@vetify/types";
import { Building2, PawPrint } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Field, FormError } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { errorMessage } from "@/lib/errors";
import {
  apiFieldErrors,
  issueToSpanish,
  validateForm,
  type FieldErrors,
} from "@/lib/forms";
import { firstName, type StepProps } from "@/lib/onboarding";
import { markTourPending } from "@/lib/tour";
import { ChoiceCard } from "../choice-card";
import { bigInput, primaryAction, StepActions, StepTitle } from "../wizard-shell";

export function WelcomeStep({ next }: StepProps) {
  return (
    <div className="flex flex-1 flex-col pt-6">
      <PawPrint className="size-14 text-primary" strokeWidth={1} aria-hidden />
      <p className="etiqueta mt-10">Expediente clínico compartido</p>
      <h1 className="mt-1 font-display text-7xl leading-[0.95] font-medium">Vetify</h1>
      <p className="mt-4 font-display text-2xl leading-tight text-primary">
        El expediente pertenece al dueño, no a la clínica.
      </p>
      <p className="mt-5 text-muted-foreground">
        Vacunas, consultas y carné digital de tu mascota, en un solo lugar y siempre con
        vos.
      </p>
      <StepActions>
        <Button variant="solido" size="lg" className={primaryAction} onClick={next}>
          Crear mi cuenta
        </Button>
        <Link
          href="/iniciar-sesion"
          className="py-3 text-center text-sm text-primary underline underline-offset-4"
        >
          Ya tengo cuenta
        </Link>
        <p className="text-center text-xs text-muted-foreground">
          Te toma unos 2 minutos.
        </p>
      </StepActions>
    </div>
  );
}

const ROLES: { role: SignUpRole; title: string; text: string; icon: typeof PawPrint }[] =
  [
    {
      role: "owner",
      title: "Tengo mascotas",
      text: "Llevá su expediente, vacunas y carné en un solo lugar.",
      icon: PawPrint,
    },
    {
      role: "clinic",
      title: "Soy una clínica",
      text: "Consultá y registrá el historial de tus pacientes, con permiso del dueño.",
      icon: Building2,
    },
  ];

/** Picking a role moves on by itself, after a beat that shows the selection. */
export function RoleStep({ update, goTo }: StepProps) {
  const [picked, setPicked] = useState<SignUpRole | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const pick = (role: SignUpRole) => {
    setPicked(role);
    update({ role, plan: role === "owner" ? "free" : "pilot" });
    timer.current = setTimeout(() => goTo("name"), 250);
  };

  return (
    <div className="flex flex-col gap-6">
      <StepTitle description="Adaptamos todo lo que sigue a tu respuesta.">
        ¿Cómo vas a usar Vetify?
      </StepTitle>
      <div className="flex flex-col gap-3">
        {ROLES.map(({ role, title, text, icon: Icon }) => (
          <ChoiceCard
            key={role}
            selected={picked === role}
            onClick={() => pick(role)}
            className="flex items-start gap-4 rounded-2xl p-5"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-primary text-primary">
              <Icon className="size-5" strokeWidth={1.5} aria-hidden />
            </span>
            <span className="flex flex-col gap-1">
              <span className="font-display text-2xl leading-tight">{title}</span>
              <span className="text-sm text-muted-foreground">{text}</span>
            </span>
          </ChoiceCard>
        ))}
      </div>
    </div>
  );
}

export function NameStep({ data, update, next }: StepProps) {
  const [error, setError] = useState<string | null>(null);
  const first = firstName(data.name);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = signUpSchema.shape.name.safeParse(data.name.trim());
    if (!result.success) return setError(issueToSpanish(result.error.issues[0]));
    update({ name: result.data });
    next();
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-1 flex-col gap-7">
      <StepTitle description="Así te vamos a saludar en la aplicación.">
        {data.role === "owner"
          ? "Primero, ¿cómo te llamás?"
          : "¿Quién es la persona responsable?"}
      </StepTitle>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm text-muted-foreground">
          Nombre y apellido
        </label>
        <input
          id="name"
          autoComplete="name"
          placeholder="Ej.: Ana Mora"
          value={data.name}
          onChange={(e) => {
            update({ name: e.target.value });
            setError(null);
          }}
          aria-invalid={!!error}
          aria-describedby={error ? "name-error" : undefined}
          className={bigInput}
        />
        {error && (
          <p id="name-error" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
      <p className="min-h-9 font-display text-2xl text-primary" aria-live="polite">
        {first && `Hola, ${first}. Qué gusto tenerte acá.`}
      </p>
      <StepActions>
        <Button type="submit" variant="solido" size="lg" className={primaryAction}>
          Continuar
        </Button>
      </StepActions>
    </form>
  );
}

/** Length is what `passwordSchema` asks for, so the meter only measures that. */
function strength(length: number): { level: number; text: string; color: string } {
  if (length === 0) return { level: 0, text: "", color: "bg-border" };
  if (length < 12) return { level: 1, text: "Muy corta", color: "bg-destructive" };
  if (length < 16) return { level: 2, text: "Buena", color: "bg-primary" };
  return { level: 3, text: "Excelente", color: "bg-primary" };
}

/** Creates the account. Past this step there is a session and no way back. */
export function AccessStep({ data, update, next }: StepProps) {
  const { register } = useSession();
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const meter = strength(password.length);
  const clinic = data.role === "clinic";

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { data: signUp, errors } = validateForm(
      event.currentTarget,
      signUpSchema,
      (d) => ({
        ...d,
        role: data.role,
        name: data.name,
      }),
    );
    setErrors(errors ?? {});
    if (!signUp) return;
    register.mutate(signUp, {
      onSuccess: (session) => {
        markTourPending(session.user.id);
        update({ email: signUp.email, clinicName: signUp.clinicName ?? "" });
        next();
      },
      onError: (error) => setErrors(apiFieldErrors(error)),
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-1 flex-col gap-5">
      <StepTitle
        description={
          clinic
            ? "Ahora los datos de la clínica y tu acceso."
            : "Ahora tus datos para entrar."
        }
      >
        Mucho gusto, {firstName(data.name)}.
      </StepTitle>
      {clinic && (
        <Field
          label="Nombre de la clínica"
          name="clinicName"
          defaultValue={data.clinicName}
          placeholder="Ej.: Veterinaria San Pedro"
          error={errors.clinicName}
          hint="Vetify revisa cada clínica antes de que pueda recibir expedientes."
        />
      )}
      <Field
        label="Correo"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={data.email}
        error={errors.email}
      />
      <Field
        label="Teléfono (opcional)"
        name="phone"
        type="tel"
        autoComplete="tel"
        error={errors.phone}
      />
      <div className="flex flex-col gap-2">
        <Field
          label="Contraseña"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint="Al menos 12 caracteres. Una frase larga es más segura que una palabra con símbolos."
        />
        <div className="flex items-center gap-3" aria-live="polite">
          <div className="grid h-1 flex-1 grid-cols-3 gap-1">
            {[1, 2, 3].map((level) => (
              <span
                key={level}
                className={`rounded-full transition-colors duration-300 ${
                  meter.level >= level ? meter.color : "bg-border"
                }`}
              />
            ))}
          </div>
          <span className="min-w-16 text-right text-xs text-muted-foreground">
            {meter.text}
          </span>
        </div>
      </div>
      <FormError message={register.isError ? errorMessage(register.error) : null} />
      <StepActions>
        <Button
          type="submit"
          variant="solido"
          size="lg"
          className={primaryAction}
          disabled={register.isPending}
        >
          {register.isPending ? "Creando tu cuenta…" : "Crear mi cuenta"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tenés cuenta?{" "}
          <Link
            href="/iniciar-sesion"
            className="text-primary underline underline-offset-4"
          >
            Iniciá sesión
          </Link>
        </p>
      </StepActions>
    </form>
  );
}
