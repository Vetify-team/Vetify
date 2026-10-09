import type { Metadata } from "next";
import { Ajustes } from "@/components/dueno/ajustes";

export const metadata: Metadata = { title: "Ajustes · Vetify" };

export default function Pagina() {
  return <Ajustes />;
}
