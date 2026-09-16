import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mis mascotas · Vetify" };

// Pendiente: listado con useMascotas() y estados de carga, error y vacío.
export default function PaginaMascotas() {
  return <h1 className="font-serif text-2xl">Mis mascotas</h1>;
}
