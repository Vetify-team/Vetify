"use client";

import { createPetSchema, type AnimalSex, type Species } from "@vetify/types";
import { Cat, Check, Dog, PawPrint, QrCode } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Field, FormError } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { useCurrentPet } from "@/hooks/useCurrentPet";
import { useCreatePet } from "@/hooks/usePets";
import { errorMessage } from "@/lib/errors";
import { age, today } from "@/lib/format";
import { issueToSpanish, type FieldErrors } from "@/lib/forms";
import { sexLabel, speciesLabel } from "@/lib/labels";
import { petPayload, type StepProps, type WizardData } from "@/lib/onboarding";
import { cn } from "cn";
import { ChoiceCard, ChoiceChips } from "../choice-card";
import { bigInput, primaryAction, StepActions, StepTitle } from "../wizard-shell";

const SPECIES: { value: Species; text: string; icon: typeof Dog }[] = [
  { value: "dog", text: "Perro", icon: Dog },
  { value: "cat", text: "Gato", icon: Cat },
  { value: "other", text: "Otra", icon: PawPrint },
];

const speciesWord: Record<Species, string> = {
  dog: "perro",
  cat: "gato",
  other: "mascota",
};

const describe = (data: WizardData): string =>
  [
    data.species && speciesLabel[data.species],
    data.sex && sexLabel[data.sex],
    age(data.birthDate || null),
  ]
    .filter(Boolean)
    .join(" · ");

/** The record card filling in while the owner types. */
export function PetCardPreview({ data }: { data: WizardData }) {
  const name = data.petName.trim();
  return (
    <div className="mb-6 flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
      <span className="flex size-13 shrink-0 items-center justify-center rounded-full border-[1.5px] border-primary font-display text-2xl text-primary">
        {(name.charAt(0) || "?").toUpperCase()}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="etiqueta">Expediente en preparación</span>
        <span className="truncate font-display text-2xl leading-tight">
          {name || "Sin nombre todavía"}
        </span>
        <span className="text-sm text-muted-foreground">
          {describe(data) || "Completá sus datos"}
        </span>
      </span>
    </div>
  );
}

export function SpeciesStep({ data, update, goTo }: StepProps) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const pick = (species: Species) => {
    update({ species });
    timer.current = setTimeout(() => goTo("petName"), 250);
  };

  return (
    <div className="flex flex-1 flex-col gap-6">
      <p className="flex w-fit items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95">
        <Check className="size-3.5 text-primary" strokeWidth={2.5} aria-hidden />
        Cuenta creada
      </p>
      <StepTitle description="Empecemos su expediente. Es tuyo y lo acompaña a cualquier veterinaria.">
        Ahora, ¿quién te acompaña?
      </StepTitle>
      <div className="grid grid-cols-3 gap-2.5">
        {SPECIES.map(({ value, text, icon: Icon }) => (
          <ChoiceCard
            key={value}
            selected={data.species === value}
            onClick={() => pick(value)}
            className="flex h-32 flex-col items-center justify-center gap-2.5 rounded-2xl"
          >
            <Icon className="size-8 text-primary" strokeWidth={1.25} aria-hidden />
            <span className="font-display text-2xl">{text}</span>
          </ChoiceCard>
        ))}
      </div>
      <StepActions>
        <button
          type="button"
          onClick={() => {
            update({ species: null, petName: "" });
            goTo("plans");
          }}
          className="min-h-11 text-sm text-primary underline underline-offset-4"
        >
          Registrar mi mascota después
        </button>
      </StepActions>
    </div>
  );
}

export function PetNameStep({ data, update, next }: StepProps) {
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = createPetSchema.shape.name.safeParse(data.petName.trim());
    if (!result.success) return setError(issueToSpanish(result.error.issues[0]));
    update({ petName: result.data });
    next();
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-1 flex-col">
      <PetCardPreview data={data} />
      <div className="flex flex-col gap-6">
        <StepTitle>¿Cómo se llama tu {speciesWord[data.species ?? "other"]}?</StepTitle>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="petName" className="text-sm text-muted-foreground">
            Nombre
          </label>
          <input
            id="petName"
            placeholder="Ej.: Luna"
            value={data.petName}
            onChange={(e) => {
              update({ petName: e.target.value });
              setError(null);
            }}
            aria-invalid={!!error}
            aria-describedby={error ? "petName-error" : undefined}
            className={bigInput}
          />
          {error && (
            <p id="petName-error" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>
      <StepActions>
        <Button type="submit" variant="solido" size="lg" className={primaryAction}>
          Continuar
        </Button>
      </StepActions>
    </form>
  );
}

export function PetDetailsStep({ data, update, goTo }: StepProps) {
  const [errors, setErrors] = useState<FieldErrors>({});

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = createPetSchema.safeParse(petPayload(data));
    if (!result.success) {
      const found: FieldErrors = {};
      for (const issue of result.error.issues) {
        found[String(issue.path[0] ?? "_")] ??= issueToSpanish(issue);
      }
      return setErrors(found);
    }
    goTo("creating");
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-1 flex-col">
      <PetCardPreview data={data} />
      <div className="flex flex-col gap-5">
        <StepTitle>Contanos un poco de {data.petName}</StepTitle>
        <ChoiceChips<AnimalSex | "">
          legend="Sexo"
          value={data.sex ?? ""}
          onChange={(sex) => update({ sex: sex || null })}
          options={[
            { value: "female", text: "Hembra" },
            { value: "male", text: "Macho" },
            { value: "", text: "Sin indicar" },
          ]}
        />
        <Field
          label="Fecha de nacimiento"
          name="birthDate"
          type="date"
          max={today()}
          value={data.birthDate}
          onChange={(e) => update({ birthDate: e.target.value })}
          error={errors.birthDate}
          hint="Con esto calculamos qué vacunas le tocan y cuándo."
        />
        <ChoiceChips<"yes" | "no">
          legend="¿Está esterilizada?"
          value={data.neutered ? "yes" : "no"}
          onChange={(v) => update({ neutered: v === "yes" })}
          options={[
            { value: "yes", text: "Sí" },
            { value: "no", text: "No" },
          ]}
        />
        <FormError message={errors.name ?? errors.species ?? errors._} />
      </div>
      <StepActions>
        <Button type="submit" variant="solido" size="lg" className={primaryAction}>
          Crear el expediente de {data.petName}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Raza, microchip y foto los agregás después desde su perfil.
        </p>
      </StepActions>
    </form>
  );
}

const MILESTONES = [
  { title: "Expediente clínico", text: "Historial, consultas y documentos" },
  { title: "Esquema de vacunas", text: "Calculado según su especie y edad" },
  { title: "Carné digital con QR", text: "Listo para mostrar y verificar" },
];

/** Milliseconds per checklist line, so the steps can be read even on a fast API. */
const BEAT = 800;

/**
 * Creates the pet once (the idempotency key covers retries) while a checklist
 * plays; the last line waits for the API.
 */
export function CreatingStep({ data, update, next, goTo }: StepProps) {
  const create = useCreatePet();
  const select = useCurrentPet((s) => s.select);
  const [beat, setBeat] = useState(0);
  const started = useRef(false);

  const run = () => {
    const parsed = createPetSchema.safeParse(petPayload(data));
    if (!parsed.success) return goTo("petDetails");
    create.mutate(parsed.data, {
      onSuccess: (pet) => {
        update({ petId: pet.id });
        select(pet.id);
      },
    });
  };

  useEffect(() => {
    // Strict Mode runs effects twice in development; the pet is created once.
    if (started.current) return;
    started.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- create on arrival only
  }, []);

  useEffect(() => {
    if (beat >= MILESTONES.length) return;
    const timer = setTimeout(() => setBeat((b) => b + 1), BEAT);
    return () => clearTimeout(timer);
  }, [beat]);

  const done = (i: number) => beat > i && (i < MILESTONES.length - 1 || create.isSuccess);
  const ready = done(MILESTONES.length - 1);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <StepTitle>
        {ready
          ? `El expediente de ${data.petName} está listo`
          : `Creando el expediente de ${data.petName}…`}
      </StepTitle>
      <ul className="border-t border-filete" aria-live="polite">
        {MILESTONES.map((m, i) => {
          const active = !done(i) && (i === 0 || done(i - 1));
          return (
            <li
              key={m.title}
              className={cn(
                "flex items-center gap-3.5 border-b border-border py-3.5 transition-opacity duration-300",
                !done(i) && !active && "opacity-45",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border-[1.5px] border-primary transition-colors duration-300",
                  done(i) && "bg-primary",
                )}
              >
                {done(i) && (
                  <Check
                    className="size-3.5 text-primary-foreground"
                    strokeWidth={3}
                    aria-hidden
                  />
                )}
              </span>
              <span className="flex flex-1 flex-col">
                <span>{m.title}</span>
                <span className="text-sm text-muted-foreground">{m.text}</span>
              </span>
              <span className="text-xs text-primary">
                {done(i) ? "Listo" : active && !create.isError ? "Creando…" : ""}
              </span>
            </li>
          );
        })}
      </ul>

      {ready && (
        <div className="flex items-center gap-4 rounded-2xl bg-foreground p-5 text-background motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="etiqueta !text-background/60">Carné de vacunación</span>
            <span className="truncate font-display text-3xl leading-tight">
              {data.petName}
            </span>
            <span className="text-sm text-background/80">{describe(data)}</span>
          </span>
          <span className="rounded-md bg-background p-2 text-foreground">
            <QrCode className="size-12" strokeWidth={1.25} aria-hidden />
          </span>
        </div>
      )}

      {create.isError && (
        <div className="flex flex-col gap-3">
          <FormError message={errorMessage(create.error)} />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => goTo("petDetails")}>
              Revisar datos
            </Button>
            <Button onClick={run} disabled={create.isPending}>
              Intentar de nuevo
            </Button>
          </div>
        </div>
      )}

      <StepActions>
        <Button
          variant="solido"
          size="lg"
          className={primaryAction}
          disabled={!ready}
          onClick={next}
        >
          Continuar
        </Button>
      </StepActions>
    </div>
  );
}
