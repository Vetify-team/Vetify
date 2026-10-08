import type { Metadata } from "next";
import { EsquemaDueno } from "@/components/expediente/esquema-dueno";

export const metadata: Metadata = { title: "Vacunación · Vetify" };

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EsquemaDueno id={id} />;
}
