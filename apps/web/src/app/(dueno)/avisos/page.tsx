import type { Metadata } from "next";
import { Avisos } from "@/components/dueno/avisos";

export const metadata: Metadata = { title: "Avisos · Vetify" };

export default function Pagina() {
  return <Avisos />;
}
