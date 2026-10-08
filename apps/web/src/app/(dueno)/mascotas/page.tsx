import type { Metadata } from "next";
import { MisMascotas } from "@/components/mascotas/mis-mascotas";

export const metadata: Metadata = { title: "Mis mascotas · Vetify" };

export default function PaginaMascotas() {
  return <MisMascotas />;
}
