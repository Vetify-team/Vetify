import type { Metadata } from "next";
import { VaccinationCard } from "@/components/pets/vaccination-card";

export const metadata: Metadata = { title: "Carné · Vetify" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VaccinationCard id={id} />;
}
