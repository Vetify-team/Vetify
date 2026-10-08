import type { Metadata } from "next";
import { PerfilMascota } from "@/components/mascotas/perfil-mascota";

export const metadata: Metadata = { title: "Perfil · Vetify" };

export default async function PaginaPerfil({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PerfilMascota id={id} />;
}
