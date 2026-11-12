"use client";

import {
  CLINIC_SIGNUP_DAYS,
  createClinicSignupLinkSchema,
  type ClinicPlanId,
} from "@vetify/types";
import { Copy } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Field, FormError, Select } from "@/components/fields";
import { LoadError, LoadingList } from "@/components/states";
import { Row, Section } from "@/components/system";
import { Button } from "@/components/ui/button";
import { useManageSignupLinks, useSignupLinks } from "@/hooks/useClinic";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { validateForm, type FieldErrors } from "@/lib/forms";
import { CLINIC_PLANS } from "@/lib/plans";

const planName = (id: ClinicPlanId) => CLINIC_PLANS.find((p) => p.id === id)?.name ?? id;

/**
 * How clinics join: once the plan is agreed and paid, the admin issues a
 * single-use link. It is emailed and shown here once, to copy it elsewhere
 * (for example WhatsApp). ONVO cannot charge before the clinic has an
 * account, so the first payment is confirmed outside the app.
 */
export function SignupLinks() {
  const links = useSignupLinks();
  const { issue, revoke } = useManageSignupLinks();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [copied, setCopied] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const { data, errors } = validateForm(form, createClinicSignupLinkSchema, (d) => ({
      ...d,
      paymentReference: d.paymentReference || undefined,
    }));
    setErrors(errors ?? {});
    setCopied(false);
    if (data) issue.mutate(data, { onSuccess: () => form.reset() });
  };

  const copy = (url: string) =>
    void navigator.clipboard.writeText(url).then(
      () => setCopied(true),
      () => setCopied(false),
    );

  return (
    <Section title="Enlaces de registro">
      <p className="pt-3 text-sm text-muted-foreground">
        Cuando la clínica ya pagó (o entra al piloto), generá su enlace. Sirve una vez,
        vence en {CLINIC_SIGNUP_DAYS} días y fija el correo y el plan. Un plan pago queda
        activo 30 días desde el registro.
      </p>
      <form onSubmit={submit} noValidate className="grid gap-4 pt-5 sm:grid-cols-2">
        <Field
          label="Correo de la clínica"
          name="email"
          type="email"
          error={errors.email}
        />
        <Field label="Nombre de la clínica" name="clinicName" error={errors.clinicName} />
        <Select
          label="Plan"
          name="plan"
          defaultValue="pilot"
          error={errors.plan}
          options={CLINIC_PLANS.map((p) => ({
            value: p.id,
            text: `${p.name} · ${p.price}`,
          }))}
        />
        <Field
          label="Referencia del pago (opcional)"
          name="paymentReference"
          placeholder="Ej.: SINPE 12345"
          error={errors.paymentReference}
        />
        <div className="flex flex-col gap-3 sm:col-span-2">
          <FormError message={issue.isError ? errorMessage(issue.error) : null} />
          <Button type="submit" className="self-start" disabled={issue.isPending}>
            {issue.isPending ? "Generando…" : "Generar y enviar enlace"}
          </Button>
        </div>
      </form>

      {issue.data && (
        <div
          role="status"
          className="mt-5 flex flex-col gap-3 rounded-lg border border-primary p-4 text-sm"
        >
          <p>
            Enviamos el enlace a <strong>{issue.data.email}</strong>. Copialo ahora si lo
            querés mandar por otro medio: no se vuelve a mostrar.
          </p>
          <code className="break-all rounded bg-muted px-2 py-1.5 text-xs">
            {issue.data.url}
          </code>
          <Button
            size="sm"
            variant="outline"
            className="self-start"
            onClick={() => copy(issue.data.url)}
          >
            <Copy className="size-4" aria-hidden />
            {copied ? "Copiado" : "Copiar enlace"}
          </Button>
        </div>
      )}

      <h3 className="etiqueta pt-6">Pendientes</h3>
      {revoke.isError && (
        <p className="text-sm text-destructive">{errorMessage(revoke.error)}</p>
      )}
      {links.isPending ? (
        <LoadingList rows={1} />
      ) : links.error ? (
        <LoadError error={links.error} retry={() => void links.refetch()} />
      ) : links.data.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">No hay enlaces pendientes.</p>
      ) : (
        links.data.map((link) => (
          <Row
            key={link.id}
            title={link.clinicName}
            detail={[
              link.email,
              planName(link.plan),
              link.paymentReference,
              `vence ${formatDate(link.expiresAt)}`,
            ]
              .filter(Boolean)
              .join(" · ")}
            right={
              <Button
                size="sm"
                variant="outline"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(link.id)}
              >
                Anular
              </Button>
            }
          />
        ))
      )}
    </Section>
  );
}
