import type { Metadata } from "next";
import { PermisosDueno } from "@/components/permisos/permisos-dueno";

export const metadata: Metadata = { title: "Permisos · Vetify" };

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PermisosDueno id={id} />;
}
