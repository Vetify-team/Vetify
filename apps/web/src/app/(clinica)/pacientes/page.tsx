import type { Metadata } from "next";
import { Pacientes } from "@/components/clinica/pacientes";

export const metadata: Metadata = { title: "Pacientes · Vetify" };

export default function Pagina() {
  return <Pacientes />;
}
