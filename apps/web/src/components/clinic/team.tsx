"use client";

import {
  CLINIC_INVITATION_DAYS,
  createClinicInvitationSchema,
  type ClinicMember,
  type ClinicRole,
} from "@vetify/types";
import { useState, type FormEvent } from "react";
import { Field, FormError, Select } from "@/components/fields";
import { Empty, LoadError, LoadingList } from "@/components/states";
import { Row, ScreenTitle, Section, StatusWord } from "@/components/system";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { useInvitations, useManageTeam, useMyClinic, useTeam } from "@/hooks/useClinic";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { validateForm, type FieldErrors } from "@/lib/forms";

const ROLE: Record<ClinicRole, string> = {
  admin: "Administrador",
  veterinarian: "Veterinario",
};

/**
 * The clinic's administrators invite their team by email and remove people
 * who leave. Whoever is removed loses access to every patient at once; what
 * they recorded stays signed with their name.
 */
export function TeamScreen() {
  const clinic = useMyClinic();
  const isAdmin = clinic.data?.role === "admin";

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      <ScreenTitle
        label="Clínica"
        title="Equipo"
        description="Cada persona entra con su propia cuenta y lo que registra queda firmado con su nombre. Si alguien deja la clínica, quitalo: pierde el acceso al instante."
      />
      {clinic.isPending ? (
        <LoadingList rows={2} />
      ) : clinic.error ? (
        <LoadError error={clinic.error} retry={() => void clinic.refetch()} />
      ) : !isAdmin ? (
        <p className="text-sm text-muted-foreground">
          Solo los administradores de la clínica gestionan el equipo.
        </p>
      ) : (
        <>
          <InviteForm />
          <PendingInvitations />
          <Members />
        </>
      )}
    </div>
  );
}

function InviteForm() {
  const { invite } = useManageTeam();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const { data, errors } = validateForm(form, createClinicInvitationSchema);
    setErrors(errors ?? {});
    setSentTo(null);
    if (!data) return;
    invite.mutate(data, {
      onSuccess: (invitation) => {
        setSentTo(invitation.email);
        form.reset();
      },
    });
  };

  return (
    <Section title="Invitar a alguien">
      <form onSubmit={submit} noValidate className="flex flex-col gap-5 pt-4">
        <Field
          label="Correo"
          name="email"
          type="email"
          autoComplete="off"
          error={errors.email}
          hint={`Le enviamos un enlace que vence en ${CLINIC_INVITATION_DAYS} días. El correo no puede tener ya una cuenta en Vetify.`}
        />
        <Select
          label="Rol"
          name="role"
          defaultValue="veterinarian"
          error={errors.role}
          options={[
            { value: "veterinarian", text: "Veterinario: atiende pacientes" },
            { value: "admin", text: "Administrador: además gestiona el equipo" },
          ]}
        />
        <FormError message={invite.isError ? errorMessage(invite.error) : null} />
        {sentTo && (
          <p role="status" className="text-sm">
            Enviamos la invitación a {sentTo}.
          </p>
        )}
        <Button type="submit" className="self-start" disabled={invite.isPending}>
          {invite.isPending ? "Enviando…" : "Enviar invitación"}
        </Button>
      </form>
    </Section>
  );
}

function PendingInvitations() {
  const invitations = useInvitations(true);
  const { revoke } = useManageTeam();

  if (invitations.isPending) return <LoadingList rows={1} />;
  if (invitations.error)
    return (
      <LoadError error={invitations.error} retry={() => void invitations.refetch()} />
    );
  if (invitations.data.length === 0) return null;
  return (
    <Section title="Invitaciones pendientes">
      {revoke.isError && (
        <p className="pt-2 text-sm text-destructive">{errorMessage(revoke.error)}</p>
      )}
      {invitations.data.map((invitation) => (
        <Row
          key={invitation.id}
          title={invitation.email}
          detail={`${ROLE[invitation.role]} · vence ${formatDate(invitation.expiresAt)}`}
          right={
            <Button
              size="sm"
              variant="outline"
              disabled={revoke.isPending}
              onClick={() => revoke.mutate(invitation.id)}
            >
              Anular
            </Button>
          }
        />
      ))}
    </Section>
  );
}

function Members() {
  const team = useTeam(true);
  const { remove } = useManageTeam();
  const { user } = useSession();

  const confirmRemove = (member: ClinicMember) => {
    if (
      window.confirm(
        `¿Quitar a ${member.name} del equipo? Pierde el acceso a todos los pacientes de inmediato.`,
      )
    )
      remove.mutate(member.userId);
  };

  return (
    <Section title="Miembros">
      {remove.isError && (
        <p className="pt-2 text-sm text-destructive">{errorMessage(remove.error)}</p>
      )}
      {team.isPending ? (
        <LoadingList rows={2} />
      ) : team.error ? (
        <LoadError error={team.error} retry={() => void team.refetch()} />
      ) : team.data.length === 0 ? (
        <Empty title="Todavía no hay nadie en el equipo." />
      ) : (
        team.data.map((member) => (
          <Row
            key={member.userId}
            title={
              <span className="flex flex-wrap items-center gap-2">
                {member.name}
                {member.userId === user?.id && (
                  <span className="text-xs text-muted-foreground">(vos)</span>
                )}
              </span>
            }
            detail={`${member.email} · desde ${formatDate(member.joinedAt)}`}
            right={
              <span className="flex items-center gap-3">
                <StatusWord action={member.role === "admin"}>
                  {ROLE[member.role]}
                </StatusWord>
                {member.userId !== user?.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={remove.isPending}
                    onClick={() => confirmRemove(member)}
                  >
                    Quitar
                  </Button>
                )}
              </span>
            }
          />
        ))
      )}
    </Section>
  );
}
