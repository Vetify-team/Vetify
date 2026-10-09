import type { Metadata } from "next";
import { FormularioIngreso } from "@/components/auth/formulario-ingreso";

export const metadata: Metadata = { title: "Iniciar sesión · Vetify" };

export default function PaginaIniciarSesion() {
  return <FormularioIngreso />;
}
