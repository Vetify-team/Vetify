import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pacientes · Vetify" };

// Pendiente: listado de pacientes. El API ya filtra por permiso activo; la UI
// nunca debe mostrar una mascota que el API podría negar.
export default function PaginaPacientes() {
  return <h1 className="font-serif text-2xl">Pacientes</h1>;
}
