import type { Metadata } from "next";
import { ExpedienteDueno } from "@/components/expediente/expediente-dueno";

export const metadata: Metadata = { title: "Expediente · Vetify" };

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExpedienteDueno id={id} />;
}
