import type { Metadata } from "next";
import { Paciente } from "@/components/clinica/paciente";

export const metadata: Metadata = { title: "Paciente · Vetify" };

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Paciente id={id} />;
}
