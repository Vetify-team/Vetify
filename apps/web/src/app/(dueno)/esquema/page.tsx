import type { Metadata } from "next";
import { IrAMascota } from "@/components/dueno/ir-a-mascota";

export const metadata: Metadata = { title: "Esquema · Vetify" };

export default function Pagina() {
  return <IrAMascota seccion="vacunas" />;
}
