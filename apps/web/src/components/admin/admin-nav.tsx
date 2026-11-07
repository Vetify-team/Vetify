"use client";

import { Building2 } from "lucide-react";
import { PortalSidebar } from "@/components/portal-sidebar";

const SECTIONS = [
  { href: "/admin/clinicas", text: "Clínicas", icon: Building2 },
] as const;

export function AdminNav() {
  return (
    <PortalSidebar label="Administración" home="/admin/clinicas" sections={SECTIONS} />
  );
}
