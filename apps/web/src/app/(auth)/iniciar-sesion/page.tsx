import type { Metadata } from "next";

export const metadata: Metadata = { title: "Iniciar sesión · Vetify" };

// Pendiente: formulario con react-hook-form + iniciarSesionSchema de
// @vetify/types. Ver .claude/skills/vetify-pantalla y docs/diseno/mockups.html.
export default function PaginaIniciarSesion() {
  return <h1 className="font-serif text-2xl">Iniciar sesión</h1>;
}
