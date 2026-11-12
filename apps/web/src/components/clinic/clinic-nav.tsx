"use client";

import { AlertCircle, BadgeCheck, CreditCard, KeyRound, User, Users } from "lucide-react";
import { PortalSidebar } from "@/components/portal-sidebar";
import { useMyClinic } from "@/hooks/useClinic";

const SECTIONS = [
  { href: "/pacientes", text: "Pacientes", icon: User },
  { href: "/vencidos", text: "Esquemas vencidos", icon: AlertCircle },
  { href: "/codigo", text: "Código de vinculación", icon: KeyRound },
  { href: "/plan", text: "Plan", icon: CreditCard },
] as const;

/** Only the clinic's administrators manage the team. */
const TEAM = { href: "/equipo", text: "Equipo", icon: Users } as const;

export function ClinicNav() {
  const { data: clinic } = useMyClinic();
  return (
    <PortalSidebar
      label="Portal clínico"
      home="/pacientes"
      sections={clinic?.role === "admin" ? [...SECTIONS, TEAM] : SECTIONS}
      subtitle={
        clinic && (
          <span data-tour="clinic-status" className="flex items-center gap-1.5">
            {clinic.name}
            {clinic.verified ? (
              <BadgeCheck className="size-4 text-primary" aria-label="Verificada" />
            ) : (
              <span className="etiqueta">· en verificación</span>
            )}
          </span>
        )
      }
    />
  );
}
