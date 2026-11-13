"use client";

import type {
  AccessLogEntry,
  LinkCodePreview,
  PermissionScope,
  PermissionWithClinic,
} from "@vetify/types";
import { BadgeCheck, Check, IdCard, ScrollText } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { cn } from "cn";
import { FormError } from "@/components/fields";
import { LoadError, LoadingList } from "@/components/states";
import { StatusPill } from "@/components/system";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useAccessLog,
  useManagePermissions,
  usePermissions,
} from "@/hooks/usePermissions";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { accessActionLabel } from "@/lib/labels";
import { formatCode, isComplete } from "@/lib/link-code";
import { CodeInput } from "./code-input";

const card =
  "rounded-3xl bg-card shadow-[0_1px_2px_rgba(29,27,24,0.06),0_8px_24px_rgba(29,27,24,0.05)] dark:shadow-none dark:ring-1 dark:ring-border";

const dayMonth = new Intl.DateTimeFormat("es-CR", { day: "numeric", month: "short" });
const time = new Intl.DateTimeFormat("es-CR", { hour: "numeric", minute: "2-digit" });

/** The two permissions an owner can give, with what each lets the clinic do. */
const SCOPES: {
  value: PermissionScope;
  title: string;
  text: string;
  icon: typeof IdCard;
}[] = [
  {
    value: "full",
    title: "Expediente completo",
    text: "Ve todo el historial y registra consultas, vacunas, desparasitaciones, tratamientos y exámenes.",
    icon: ScrollText,
  },
  {
    value: "card_only",
    title: "Solo el carné",
    text: "Ve únicamente la vigencia de las vacunas. No ve consultas ni exámenes y no registra nada.",
    icon: IdCard,
  },
];
const scopeTitle = (scope: PermissionScope) =>
  SCOPES.find((s) => s.value === scope)!.title;

/** Consent: grant in three visible steps, the clinics with access, and who looked. */
export function PermissionsManager({ petId }: { petId: string }) {
  return (
    <div className="flex flex-col gap-8">
      <GrantAccess petId={petId} />
      <ClinicsWithAccess petId={petId} />
      <AccessLog petId={petId} />
    </div>
  );
}

// ---------- 1, 2, 3: grant access ----------

type Step = 1 | 2 | 3;

/**
 * The owner types the code the clinic shows them, confirms which clinic it
 * is, and chooses what it may do. A code typed blindly never grants: the
 * clinic is always shown before the permission is given.
 */
function GrantAccess({ petId }: { petId: string }) {
  const { preview, grant } = useManagePermissions(petId);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [found, setFound] = useState<LinkCodePreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [scope, setScope] = useState<PermissionScope>("full");
  const [granted, setGranted] = useState<string | null>(null);
  const step: Step = !found ? 1 : !confirmed ? 2 : 3;

  const search = (value: string) => {
    if (!isComplete(value)) return setCodeError("El código tiene 8 caracteres.");
    setCodeError(null);
    preview.mutate(value, { onSuccess: setFound });
  };
  const restart = () => {
    setCode("");
    setFound(null);
    setConfirmed(false);
    setScope("full");
    preview.reset();
    grant.reset();
  };
  const give = (event: FormEvent) => {
    event.preventDefault();
    if (!found) return;
    grant.mutate(
      { code, scope },
      {
        onSuccess: () => {
          setGranted(
            `${found.clinic.name} ya tiene acceso: ${scopeTitle(scope).toLowerCase()}.`,
          );
          restart();
        },
      },
    );
  };

  return (
    <section
      aria-labelledby="grant"
      className={cn(card, "flex flex-col gap-6 p-5 sm:p-7")}
    >
      <div>
        <h2 id="grant" className="font-display text-3xl leading-tight">
          Dar acceso a una clínica
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pedile a la clínica su código. Solo las clínicas verificadas por Vetify pueden
          generarlo y cada código sirve una vez.
        </p>
      </div>

      {granted && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-2xl bg-ok/12 p-4 text-sm text-ok"
        >
          <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> {granted}
        </p>
      )}

      <ol className="flex flex-col gap-6">
        <StepItem n={1} title="Escribí el código" step={step}>
          {step === 1 ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                search(code);
              }}
              noValidate
              className="flex flex-col gap-3"
            >
              <CodeInput
                value={code}
                onChange={(next) => {
                  setCode(next);
                  setCodeError(null);
                  setGranted(null);
                  preview.reset();
                }}
                onComplete={search}
                invalid={!!codeError || preview.isError}
                describedBy="code-error"
              />
              <div id="code-error">
                <FormError
                  message={
                    codeError ?? (preview.isError ? errorMessage(preview.error) : null)
                  }
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                className="w-fit"
                disabled={preview.isPending}
              >
                {preview.isPending ? "Buscando…" : "Buscar clínica"}
              </Button>
            </form>
          ) : (
            <p className="flex items-center gap-3 text-sm">
              <span className="font-mono text-lg tracking-widest">
                {formatCode(code)}
              </span>
              <button
                type="button"
                onClick={restart}
                className="text-primary underline underline-offset-4"
              >
                Cambiar
              </button>
            </p>
          )}
        </StepItem>

        <StepItem n={2} title="Confirmá la clínica" step={step}>
          {found && (
            <div className="flex flex-col gap-3">
              <div className="rounded-2xl bg-background/70 p-4">
                <p className="font-display text-2xl leading-tight">{found.clinic.name}</p>
                {found.clinic.address && (
                  <p className="text-sm text-muted-foreground">{found.clinic.address}</p>
                )}
                {found.clinic.verified && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-ok/12 px-2.5 py-1 text-xs font-medium text-ok">
                    <BadgeCheck className="size-3.5" aria-hidden /> Verificada por Vetify
                  </p>
                )}
              </div>
              {step === 2 ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    ¿Es la clínica donde estás? Si no la reconocés, no sigas.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="solido" onClick={() => setConfirmed(true)}>
                      Sí, es esta clínica
                    </Button>
                    <Button variant="ghost" onClick={restart}>
                      No es esta
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </StepItem>

        <StepItem n={3} title="Elegí qué puede ver" step={step} last>
          {step === 3 && found && (
            <form onSubmit={give} className="flex flex-col gap-4">
              <fieldset className="grid gap-3 sm:grid-cols-2">
                <legend className="sr-only">Permiso para {found.clinic.name}</legend>
                {SCOPES.map(({ value, title, text, icon: Icon }) => (
                  <label
                    key={value}
                    className={cn(
                      "flex cursor-pointer flex-col gap-2 rounded-2xl border-2 p-4 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                      scope === value
                        ? "border-primary bg-primary/6"
                        : "border-input hover:border-foreground/30",
                    )}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 font-display text-xl">
                        <Icon
                          className="size-5 text-primary"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                        {title}
                      </span>
                      <input
                        type="radio"
                        name="scope"
                        value={value}
                        checked={scope === value}
                        onChange={() => setScope(value)}
                        className="size-5 accent-[var(--primary)]"
                      />
                    </span>
                    <span className="text-sm text-muted-foreground">{text}</span>
                  </label>
                ))}
              </fieldset>
              <FormError message={grant.isError ? errorMessage(grant.error) : null} />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="solido" disabled={grant.isPending}>
                  {grant.isPending ? "Guardando…" : `Dar acceso a ${found.clinic.name}`}
                </Button>
                <Button type="button" variant="ghost" onClick={restart}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </StepItem>
      </ol>
    </section>
  );
}

function StepItem({
  n,
  title,
  step,
  last,
  children,
}: {
  n: Step;
  title: string;
  step: Step;
  last?: boolean;
  children: ReactNode;
}) {
  const done = step > n;
  const current = step === n;
  return (
    <li className="relative flex gap-4" aria-current={current ? "step" : undefined}>
      {!last && (
        <span
          aria-hidden
          className={cn(
            "absolute top-9 bottom-[-1.5rem] left-[0.95rem] w-0.5 rounded-full",
            done ? "bg-primary" : "bg-border",
          )}
        />
      )}
      <span
        className={cn(
          "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
          done
            ? "bg-primary text-primary-foreground"
            : current
              ? "border-2 border-primary text-primary"
              : "border-2 border-border text-muted-foreground",
        )}
      >
        {done ? <Check className="size-4" aria-label="Listo" /> : n}
      </span>
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-3 pt-1",
          !done && !current && "opacity-50",
        )}
      >
        <h3 className="font-medium">{title}</h3>
        {(done || current) && children}
      </div>
    </li>
  );
}

// ---------- The clinics with access ----------

function ClinicsWithAccess({ petId }: { petId: string }) {
  const { data, error, isPending, refetch } = usePermissions(petId);
  return (
    <section aria-labelledby="with-access" className="flex flex-col gap-3">
      <h2 id="with-access" className="font-display text-3xl leading-tight">
        Clínicas con acceso
      </h2>
      {isPending ? (
        <LoadingList rows={1} />
      ) : error ? (
        <LoadError error={error} retry={() => void refetch()} />
      ) : data.length === 0 ? (
        <p className={cn(card, "p-5 text-sm text-muted-foreground")}>
          Ninguna clínica tiene acceso todavía. Cuando le des acceso a tu veterinaria,
          aparece acá.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.map((permission) => (
            <li key={permission.id}>
              <ClinicCard permission={permission} petId={petId} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ClinicCard({
  permission,
  petId,
}: {
  permission: PermissionWithClinic;
  petId: string;
}) {
  const { revoke, restore } = useManagePermissions(petId);
  const [asking, setAsking] = useState(false);
  const active = permission.status === "active";
  const { clinic } = permission;

  return (
    <div className={cn(card, "flex h-full flex-col gap-3 p-5", !active && "opacity-75")}>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 font-display text-2xl leading-tight">{clinic.name}</p>
        {clinic.suspendedAt ? (
          <StatusPill tone="alert">Suspendida</StatusPill>
        ) : active ? (
          <StatusPill tone="ok">Con acceso</StatusPill>
        ) : (
          <StatusPill tone="muted">Sin acceso</StatusPill>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {scopeTitle(permission.scope)} · desde {formatDate(permission.createdAt)}
      </p>
      {clinic.suspendedAt && (
        <p className="text-xs text-muted-foreground">
          Vetify suspendió esta clínica: no puede ver el expediente mientras tanto.
        </p>
      )}
      <FormError
        message={
          revoke.isError || restore.isError
            ? errorMessage(revoke.error ?? restore.error)
            : null
        }
      />
      <div className="mt-auto pt-1">
        {active ? (
          <Button variant="outline" size="sm" onClick={() => setAsking(true)}>
            Quitar acceso
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={restore.isPending}
            onClick={() => restore.mutate(permission.id)}
          >
            {restore.isPending ? "Restableciendo…" : "Restablecer el acceso"}
          </Button>
        )}
      </div>

      <Dialog open={asking} onOpenChange={setAsking}>
        <DialogContent className="gap-5 rounded-2xl p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-medium">
              ¿Quitarle el acceso a {clinic.name}?
            </DialogTitle>
            <DialogDescription>
              Lo pierde de inmediato. Lo que ya registró se queda en el expediente, y
              podés restablecer el acceso cuando quieras.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-6 -mb-6 rounded-b-2xl px-6">
            <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
            <Button
              variant="destructive"
              disabled={revoke.isPending}
              onClick={() =>
                revoke.mutate(permission.id, { onSuccess: () => setAsking(false) })
              }
            >
              {revoke.isPending ? "Quitando…" : "Quitar acceso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Who looked ----------

const who = (e: AccessLogEntry) =>
  !e.actor ? "Alguien" : e.actor.role === "owner" ? "Vos" : e.actor.name;

function AccessLog({ petId }: { petId: string }) {
  // The owner's own actions are hidden by default: what matters is who else looked.
  const [includeMine, setIncludeMine] = useState(false);
  const log = useAccessLog(petId, includeMine ? "all" : "others");
  const entries = log.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section aria-labelledby="log" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="log" className="font-display text-3xl leading-tight">
            Quién vio el expediente
          </h2>
          <p className="text-sm text-muted-foreground">
            Cada vez que una clínica lo abre, queda anotado acá.
          </p>
        </div>
        <button
          type="button"
          aria-pressed={includeMine}
          onClick={() => setIncludeMine(!includeMine)}
          className="text-sm text-primary underline underline-offset-4"
        >
          {includeMine ? "Ver solo las clínicas" : "Incluir lo mío"}
        </button>
      </div>
      <div className={cn(card, "px-5 py-2")}>
        {log.isPending ? (
          <LoadingList rows={2} />
        ) : log.error ? (
          <LoadError error={log.error} retry={() => void log.refetch()} />
        ) : entries.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            Ninguna clínica abrió el expediente todavía.
          </p>
        ) : (
          <ul className="divide-y divide-border/70">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block truncate">{accessActionLabel(e.action)}</span>
                  <span className="block text-xs text-muted-foreground">{who(e)}</span>
                </span>
                <time
                  dateTime={e.occurredAt}
                  className="shrink-0 text-right text-xs text-muted-foreground"
                >
                  {dayMonth.format(new Date(e.occurredAt))}
                  <span className="block">{time.format(new Date(e.occurredAt))}</span>
                </time>
              </li>
            ))}
          </ul>
        )}
        {log.hasNextPage && (
          <Button
            variant="ghost"
            className="my-2 w-full"
            disabled={log.isFetchingNextPage}
            onClick={() => void log.fetchNextPage()}
          >
            {log.isFetchingNextPage ? "Cargando…" : "Ver más"}
          </Button>
        )}
      </div>
    </section>
  );
}
