import type { Metadata } from "next";
import { PesoDueno } from "@/components/expediente/peso-dueno";

export const metadata: Metadata = { title: "Serie de peso · Vetify" };

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PesoDueno id={id} />;
}
