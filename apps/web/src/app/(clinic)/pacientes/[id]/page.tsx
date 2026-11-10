import type { Metadata } from "next";
import { Patient } from "@/components/clinic/patient";

export const metadata: Metadata = { title: "Paciente" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Patient id={id} />;
}
