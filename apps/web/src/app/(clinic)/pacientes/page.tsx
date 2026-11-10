import type { Metadata } from "next";
import { Patients } from "@/components/clinic/patients";

export const metadata: Metadata = { title: "Pacientes" };

export default function Page() {
  return <Patients />;
}
