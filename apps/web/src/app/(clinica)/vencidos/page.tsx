import type { Metadata } from "next";
import { Vencidos } from "@/components/clinica/vencidos";

export const metadata: Metadata = { title: "Esquemas vencidos · Vetify" };

export default function Pagina() {
  return <Vencidos />;
}
