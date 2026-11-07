import type { Metadata } from "next";
import { PetProfile } from "@/components/pets/pet-profile";

export const metadata: Metadata = { title: "Perfil · Vetify" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PetProfile id={id} />;
}
