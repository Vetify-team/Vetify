"use client";

import { crearMascotaSchema } from "@vetify/types";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Campo, ErrorFormulario, Selector } from "@/components/campos";
import { Button } from "@/components/ui/button";
import { useCrearMascota } from "@/hooks/useMascotas";
import { hoy } from "@/lib/formato";
import {
  erroresDeApi,
  mensajeDeError,
  validarFormulario,
  type ErroresDeCampo,
} from "@/lib/formularios";

export function FormularioMascota() {
  const crear = useCrearMascota();
  const router = useRouter();
  const [errores, setErrores] = useState<ErroresDeCampo>({});

  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const { datos, errores } = validarFormulario(
      evento.currentTarget,
      crearMascotaSchema,
      (d) => ({
        ...d,
        esterilizado: d.esterilizado === "si",
      }),
    );
    setErrores(errores ?? {});
    if (!datos) return;
    crear.mutate(datos, {
      onSuccess: (mascota) => router.replace(`/mascotas/${mascota.id}`),
      onError: (error) => setErrores(erroresDeApi(error)),
    });
  };

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
      <Campo etiqueta="Nombre" nombre="nombre" error={errores.nombre} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Selector
          etiqueta="Especie"
          nombre="especie"
          opciones={[
            { valor: "perro", texto: "Perro" },
            { valor: "gato", texto: "Gato" },
            { valor: "otro", texto: "Otra" },
          ]}
          error={errores.especie}
        />
        <Campo
          etiqueta="Raza"
          nombre="raza"
          placeholder="Ej.: zaguate"
          error={errores.raza}
        />
        <Selector
          etiqueta="Sexo"
          nombre="sexo"
          opciones={[
            { valor: "", texto: "Sin indicar" },
            { valor: "hembra", texto: "Hembra" },
            { valor: "macho", texto: "Macho" },
          ]}
          error={errores.sexo}
        />
        <Campo
          etiqueta="Fecha de nacimiento"
          nombre="fechaNacimiento"
          type="date"
          max={hoy()}
          error={errores.fechaNacimiento}
          ayuda="Se usa para calcular qué vacunas le tocan."
        />
        <Selector
          etiqueta="¿Está esterilizada?"
          nombre="esterilizado"
          opciones={[
            { valor: "no", texto: "No" },
            { valor: "si", texto: "Sí" },
          ]}
        />
        <Campo
          etiqueta="Microchip (opcional)"
          nombre="microchip"
          error={errores.microchip}
        />
      </div>
      <ErrorFormulario mensaje={crear.isError ? mensajeDeError(crear.error) : null} />
      <Button type="submit" size="lg" disabled={crear.isPending}>
        {crear.isPending ? "Guardando…" : "Registrar mascota"}
      </Button>
    </form>
  );
}
