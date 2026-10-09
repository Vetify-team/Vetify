import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FormularioMascota } from "@/components/mascotas/formulario-mascota";
import { TituloPantalla } from "@/components/sistema";

export const metadata: Metadata = { title: "Nueva mascota · Vetify" };

export default function PaginaNuevaMascota() {
  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/mascotas"
        className="-mb-4 flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Mis mascotas
      </Link>
      <TituloPantalla
        etiqueta="Nuevo expediente"
        titulo="Registrar mascota"
        descripcion="Nombre y especie son obligatorios. La fecha de nacimiento sirve para calcular qué vacunas le tocan."
      />
      <FormularioMascota />
    </div>
  );
}
