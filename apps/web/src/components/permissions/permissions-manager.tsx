"use client";

import {
  linkCodeInputSchema,
  type AccessLogEntry,
  type LinkCodePreview,
  type PermissionScope,
  type PermissionWithClinic,
} from "@vetify/types";
import { BadgeCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Field, FormError } from "@/components/fields";
import { LoadError, LoadingList } from "@/components/states";
import { Row, Section } from "@/components/system";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  useAccessLog,
  useManagePermissions,
  usePermissions,
} from "@/hooks/usePermissions";
import { errorMessage } from "@/lib/errors";
import { validateForm, type FieldErrors } from "@/lib/forms";
import { accessActionLabel, scopeLabel } from "@/lib/labels";
import { cn } from "cn";

const monthYear = new Intl.DateTimeFormat("es-CR", { month: "short", year: "numeric" });
const dayMonth = new Intl.DateTimeFormat("es-CR", { day: "numeric", month: "short" });

function PermissionRow({
  permission,
  petId,
}: {
  permission: PermissionWithClinic;
  petId: string;
}) {
  const { revoke, restore } = useManagePermissions(petId);
  const active = permission.status === "active";
  const busy = revoke.isPending || restore.isPending;

  const toggle = (on: boolean) => {
    if (on) restore.mutate(permission.id);
    else if (
      window.confirm(
        `¿Quitarle el acceso a ${permission.clinic.name}? Lo pierde de inmediato.`,
      )
    )
      revoke.mutate(permission.id);
  };

  return (
    <div className="fila flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className={cn(!active && "text-muted-foreground")}>{permission.clinic.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {active ? scopeLabel[permission.scope] : "Sin acceso"} · desde{" "}
          {monthYear.format(new Date(permission.createdAt))}
        </p>
        {(revoke.isError || restore.isError) && (
          <p className="mt-1 text-xs text-destructive">
            {errorMessage(revoke.error ?? restore.error)}
          </p>
        )}
      </div>
      <Switch
        checked={active}
        disabled={busy}
        onCheckedChange={toggle}
        aria-label={`Acceso de ${permission.clinic.name}`}
      />
    </div>
  );
}

/**
 * Granting takes two steps: the owner types the code the clinic shows them,
 * sees which clinic it is, and confirms. A code typed blindly never grants.
 */
function GrantAccess({ petId }: { petId: string }) {
  const { preview, grant } = useManagePermissions(petId);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [found, setFound] = useState<{ code: string; preview: LinkCodePreview } | null>(
    null,
  );
  const [scope, setScope] = useState<PermissionScope>("full");

  const check = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { data, errors } = validateForm(event.currentTarget, linkCodeInputSchema);
    setErrors(errors ?? {});
    if (!data) return;
    preview.mutate(data.code, {
      onSuccess: (result) => setFound({ code: data.code, preview: result }),
    });
  };

  const confirm = () => {
    if (!found) return;
    grant.mutate({ code: found.code, scope }, { onSuccess: () => setFound(null) });
  };

  return (
    <Section title="Dar acceso a una clínica">
      {!found ? (
        <form onSubmit={check} noValidate className="flex flex-col gap-4 pt-4">
          <p className="text-sm text-muted-foreground">
            Pedile a la clínica su código de vinculación. Solo las clínicas verificadas
            por Vetify pueden generarlo, y cada código sirve una vez.
          </p>
          <Field
            label="Código de la clínica"
            name="code"
            placeholder="K7PQ-4MXA"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="h-11 rounded-md bg-transparent px-3 font-mono text-lg tracking-[0.2em] uppercase"
            error={errors.code}
          />
          <FormError message={preview.isError ? errorMessage(preview.error) : null} />
          <Button type="submit" variant="outline" disabled={preview.isPending}>
            {preview.isPending ? "Buscando…" : "Buscar clínica"}
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-4 pt-4">
          <div className="rounded-lg border border-border p-4">
            <p className="flex items-center gap-2 font-display text-2xl">
              {found.preview.clinic.name}
              {found.preview.clinic.verified && (
                <BadgeCheck
                  className="size-5 text-primary"
                  aria-label="Clínica verificada"
                />
              )}
            </p>
            {found.preview.clinic.address && (
              <p className="text-sm text-muted-foreground">
                {found.preview.clinic.address}
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Verificada por Vetify. Confirmá que es la clínica donde estás.
            </p>
          </div>
          <fieldset className="flex flex-wrap gap-2 text-sm">
            <legend className="sr-only">Qué puede hacer</legend>
            {(Object.keys(scopeLabel) as PermissionScope[]).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={scope === option}
                onClick={() => setScope(option)}
                className="min-h-9 rounded-full border border-border px-3 text-muted-foreground aria-pressed:border-foreground aria-pressed:text-foreground"
              >
                {scopeLabel[option]}
              </button>
            ))}
          </fieldset>
          <FormError message={grant.isError ? errorMessage(grant.error) : null} />
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => setFound(null)}>
              Cancelar
            </Button>
            <Button onClick={confirm} disabled={grant.isPending}>
              {grant.isPending ? "Guardando…" : "Dar acceso"}
            </Button>
          </div>
        </div>
      )}
    </Section>
  );
}

const who = (e: AccessLogEntry) =>
  !e.actor ? "Alguien" : e.actor.role === "owner" ? "Vos" : e.actor.name;

function AccessLog({ petId }: { petId: string }) {
  // The owner's own actions are hidden by default: what matters is who else looked.
  const [includeMine, setIncludeMine] = useState(false);
  const log = useAccessLog(petId, includeMine ? "all" : "others");
  const entries = log.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Section
      title="Bitácora"
      extra={
        <button
          type="button"
          onClick={() => setIncludeMine(!includeMine)}
          className="underline underline-offset-4"
        >
          {includeMine ? "Solo clínicas" : "Incluir lo mío"}
        </button>
      }
    >
      {log.isPending ? (
        <LoadingList rows={2} />
      ) : log.error ? (
        <LoadError error={log.error} retry={() => void log.refetch()} />
      ) : entries.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          Ninguna clínica accedió todavía.
        </p>
      ) : (
        <>
          {entries.map((e) => (
            <Row
              key={e.id}
              title={accessActionLabel(e.action)}
              detail={who(e)}
              right={
                <time className="text-xs text-muted-foreground">
                  {dayMonth.format(new Date(e.occurredAt))}
                </time>
              }
            />
          ))}
          {log.hasNextPage && (
            <Button
              variant="outline"
              className="mt-4"
              disabled={log.isFetchingNextPage}
              onClick={() => void log.fetchNextPage()}
            >
              {log.isFetchingNextPage ? "Cargando…" : "Ver más"}
            </Button>
          )}
        </>
      )}
    </Section>
  );
}

/** Consent: who sees the record, switch access on or off, grant with a code, and the log. */
export function PermissionsManager({ petId }: { petId: string }) {
  const { data, error, isPending, refetch } = usePermissions(petId);

  return (
    <div className="flex flex-col gap-10">
      <Section title="Con acceso">
        {isPending ? (
          <LoadingList rows={2} />
        ) : error ? (
          <LoadError error={error} retry={() => void refetch()} />
        ) : data.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            Ninguna clínica tiene acceso. Usá el código de tu veterinaria para compartir
            el expediente.
          </p>
        ) : (
          data.map((permission) => (
            <PermissionRow key={permission.id} permission={permission} petId={petId} />
          ))
        )}
      </Section>
      <GrantAccess petId={petId} />
      <AccessLog petId={petId} />
    </div>
  );
}
