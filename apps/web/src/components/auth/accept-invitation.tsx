"use client";

import { acceptClinicInvitationSchema, type ClinicRole } from "@vetify/types";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { Field, FormError } from "@/components/fields";
import { LoadingList } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { api, ApiRequestError } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { validateForm, type FieldErrors } from "@/lib/forms";
import { LANDING_PAGES, siteHref } from "@/lib/sites";

const ROLE: Record<ClinicRole, string> = {
  admin: "administrador",
  veterinarian: "veterinario",
};

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

/** The emailed invitation opens this page: the person creates their account. */
export function AcceptInvitation() {
  const token = useSyncExternalStore(onHashChange, readToken, () => null);
  if (token === null) return null;
  return <InvitationForm key={token} token={token} />;
}

function DeadLink({ reason }: { reason: string }) {
  return (
    <div className="flex flex-col gap-5" role="alert">
      <h1 className="titulo-seccion">La invitación no sirve</h1>
      <p className="text-muted-foreground">{reason}</p>
      <Link
        href="/iniciar-sesion"
        className="text-sm text-primary underline underline-offset-4"
      >
        Iniciar sesión
      </Link>
    </div>
  );
}

function InvitationForm({ token }: { token: string }) {
  const router = useRouter();
  const { acceptInvitation } = useSession();
  const [errors, setErrors] = useState<FieldErrors>({});
  const preview = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => api.previewInvitation(token),
    enabled: !!token,
    retry: false,
  });

  // Out of the address bar, history and screenshots once it is read.
  useEffect(() => {
    if (token) window.history.replaceState(null, "", window.location.pathname);
  }, [token]);

  if (!token)
    return (
      <DeadLink reason="Abrí esta página desde el enlace que te enviaron por correo." />
    );
  if (preview.isPending) return <LoadingList rows={2} />;
  const failure = preview.error ?? acceptInvitation.error;
  if (
    failure instanceof ApiRequestError &&
    (failure.code === "INVITATION_INVALID" || failure.code === "CLINIC_SUSPENDED")
  )
    return <DeadLink reason={errorMessage(failure)} />;
  if (preview.error) return <DeadLink reason={errorMessage(preview.error)} />;
  const invitation = preview.data;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { data, errors } = validateForm(
      event.currentTarget,
      acceptClinicInvitationSchema,
      (d) => ({
        ...d,
        token,
        // A checked box submits "on"; unchecked submits nothing.
        acceptTerms: d.acceptTerms === "on" ? true : undefined,
      }),
    );
    setErrors(errors ?? {});
    if (data)
      acceptInvitation.mutate(data, { onSuccess: () => router.replace("/pacientes") });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="titulo-seccion">Sumate a {invitation.clinicName}</h1>
        <p className="text-sm text-muted-foreground">
          Te invitaron como {ROLE[invitation.role]}. Tu cuenta usa el correo{" "}
          <span className="text-foreground">{invitation.email}</span>. La invitación vence
          el {formatDate(invitation.expiresAt)}.
        </p>
      </div>
      <Field label="Tu nombre" name="name" autoComplete="name" error={errors.name} />
      <Field
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        error={errors.password}
        hint="Al menos 12 caracteres. Una frase larga es más segura que una palabra con símbolos."
      />
      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="acceptTerms"
            aria-invalid={!!errors.acceptTerms}
            aria-describedby={errors.acceptTerms ? "acceptTerms-error" : undefined}
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <span>
            Leí y acepto los{" "}
            <a
              href={siteHref("landing", LANDING_PAGES.terms)}
              target="_blank"
              rel="noopener"
              className="text-primary underline underline-offset-4"
            >
              términos y condiciones
            </a>
            .
          </span>
        </label>
        {errors.acceptTerms && (
          <p id="acceptTerms-error" className="pl-7 text-sm text-destructive">
            {errors.acceptTerms}
          </p>
        )}
      </div>
      <FormError
        message={acceptInvitation.isError ? errorMessage(acceptInvitation.error) : null}
      />
      <Button type="submit" size="lg" disabled={acceptInvitation.isPending}>
        {acceptInvitation.isPending ? "Creando tu cuenta…" : "Crear mi cuenta"}
      </Button>
    </form>
  );
}
