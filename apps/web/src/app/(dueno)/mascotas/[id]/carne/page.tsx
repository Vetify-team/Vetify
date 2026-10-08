import type { Metadata } from "next";
import { Carne } from "@/components/mascotas/carne";

export const metadata: Metadata = { title: "Carné · Vetify" };

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Carne id={id} />;
}
