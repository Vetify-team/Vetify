"use client";

import { CargandoLista } from "@/components/estados";
import { EstadoTexto, Etiqueta, Fila, Inicial, Seccion } from "@/components/sistema";
import { useAvisos } from "@/hooks/useExpediente";
import { fecha, nombreEspecie } from "@/lib/formato";
import { descripcionMascota, resumenAvisos } from "./mascota-utiles";
import { PantallaMascota } from "./pantalla-mascota";

/** Perfil de la mascota: datos y las puertas a cada parte del expediente. */
export function PerfilMascota({ id }: { id: string }) {
  const avisos = useAvisos();

  return (
    <PantallaMascota id={id} volver={{ href: "/mascotas", texto: "Mis mascotas" }}>
      {(m) => {
        const propios = avisos.data?.filter((a) => a.mascotaId === m.id) ?? [];
        const resumen = resumenAvisos(propios);
        const atencion = propios
          .filter((a) => a.estado !== "vigente" && a.estado !== "no_aplica_aun")
          .slice(0, 3);
        const datos = [
          ["Especie", nombreEspecie[m.especie]],
          ["Raza", m.raza],
          ["Sexo", m.sexo === "macho" ? "Macho" : m.sexo === "hembra" ? "Hembra" : null],
          ["Nacimiento", m.fechaNacimiento ? fecha(m.fechaNacimiento) : null],
          ["Esterilizado", m.esterilizado ? "Sí" : "No"],
          ["Microchip", m.microchip],
        ].filter((d): d is [string, string] => !!d[1]);

        return (
          <>
            <header className="flex items-center gap-5">
              <Inicial nombre={m.nombre} grande />
              <div className="min-w-0">
                <Etiqueta>Perfil</Etiqueta>
                <h1 className="font-display text-4xl font-medium">{m.nombre}</h1>
                <p className="text-sm text-muted-foreground">{descripcionMascota(m)}</p>
              </div>
            </header>

            <Seccion titulo="Expediente">
              <Fila
                href={`/mascotas/${m.id}/expediente`}
                titulo="Historial completo"
                detalle="Consultas, vacunas, tratamientos y observaciones"
              />
              <Fila
                href={`/mascotas/${m.id}/vacunas`}
                titulo="Vacunación y desparasitación"
                detalle="Esquema según especie, edad y país"
                derecha={
                  avisos.data && (
                    <span
                      className={
                        resumen.accion
                          ? "border-b border-current font-display text-[0.72rem] font-bold uppercase tracking-[0.16em]"
                          : "font-display text-[0.72rem] uppercase tracking-[0.16em] text-muted-foreground"
                      }
                    >
                      {resumen.texto}
                    </span>
                  )
                }
              />
              <Fila
                href={`/mascotas/${m.id}/peso`}
                titulo="Serie de peso"
                detalle="Evolución y registro de hoy"
              />
              <Fila
                href={`/mascotas/${m.id}/carne`}
                titulo="Carné digital"
                detalle="Vigencia de vacunas para terceros"
              />
              <Fila
                href={`/mascotas/${m.id}/permisos`}
                titulo="Quién puede verlo"
                detalle="Clínicas con acceso y bitácora"
              />
            </Seccion>

            {avisos.isPending ? (
              <CargandoLista filas={1} />
            ) : (
              atencion.length > 0 && (
                <Seccion titulo="Requiere atención">
                  {atencion.map((a) => (
                    <Fila
                      key={a.nombre}
                      titulo={a.nombre}
                      detalle={a.fecha ? fecha(a.fecha) : "Sin aplicar"}
                      derecha={<EstadoTexto estado={a.estado} fecha={a.fecha} />}
                    />
                  ))}
                </Seccion>
              )
            )}

            <Seccion titulo="Datos">
              <dl>
                {datos.map(([clave, valor]) => (
                  <div key={clave} className="fila flex justify-between gap-4 text-sm">
                    <dt className="text-muted-foreground">{clave}</dt>
                    <dd className={clave === "Microchip" ? "font-mono" : undefined}>
                      {valor}
                    </dd>
                  </div>
                ))}
              </dl>
            </Seccion>
          </>
        );
      }}
    </PantallaMascota>
  );
}
