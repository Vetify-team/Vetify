# Plan de desarrollo: Vetify

> Qué falta para la entrega final del **13 de noviembre de 2026** y en qué orden.
> La entrega final se evalúa así: **aplicación 65 %** (funcionalidad, usabilidad y diseño
> gráfico, defensa) y **documentación 35 %** (documento del proyecto, modelo de datos,
> manuales técnico y de usuario).

## Dónde estamos (9 oct 2026, II Avance entregado)

Funciona de punta a punta en local (PostgreSQL en Docker): autenticación con refresh rotado,
mascotas, expediente compartido, permisos con revocación inmediata y bitácora, esquema de
vacunación de Costa Rica, avisos con exportación ICS, serie de peso, carné con vigencias y portal
de la clínica. 17 pruebas unitarias y CI en verde. Detalle en [`AVANCE_2.md`](./AVANCE_2.md).

**Lo que no está bien todavía:** la interfaz. Cumple el sistema de diseño del I Avance, pero se
ve genérica y plana: pocas jerarquías, sin identidad propia de cada mascota, sin fotografía, sin
visualizaciones con carácter, y el portal clínico no funciona en el teléfono. Como el diseño
gráfico y la usabilidad se califican en la entrega final, el rediseño es una fase propia y va
**antes** de construir las pantallas nuevas, para no hacerlas dos veces.

---

## Calendario

| Semana         | Fase                                         |
| -------------- | -------------------------------------------- |
| 9 a 15 oct     | Fase 1: producción y correcciones del avance |
| 13 a 22 oct    | Fase 2: rediseño de la interfaz              |
| 20 a 29 oct    | Fase 3: carné QR, PDF y notificaciones       |
| 27 oct a 5 nov | Fase 4: analítica e IA                       |
| 3 a 12 nov     | Fase 5: cierre, documentación y defensa      |

Las fases 1 y 2 se solapan: la 1 es casi todo API e infraestructura, la 2 es solo `apps/web`.

---

## Fase 1: producción y correcciones del avance

**Infraestructura** (requiere las cuentas del equipo):

1. Crear el proyecto en **Neon** y aplicar las migraciones con `prisma migrate deploy`.
2. Crear el servicio del API en **Render** desde el `Dockerfile`, con las variables de
   `apps/api/.env.example` (secretos JWT nuevos, `CORS_ORIGIN` con el dominio de Vercel).
3. Crear el proyecto de **Vercel** para `apps/web` con `NEXT_PUBLIC_API_URL` apuntando a Render.
4. Cargar los secretos del workflow `deploy.yml` en GitHub (`VERCEL_TOKEN`, `VERCEL_ORG_ID`,
   `VERCEL_PROJECT_ID`, `RENDER_DEPLOY_HOOK`) y comprobar que un merge a `main` despliega solo.
5. Datos de demostración: un script `seed` con una clínica, dos dueños y tres mascotas con
   historia, para no registrar todo a mano en la defensa.

**Correcciones detectadas en el avance:**

- **Vacuna fuera del esquema:** el formulario de la clínica ofrece las vacunas del esquema y
  además la opción "Otra vacuna" con nombre libre. Esas vacunas quedan en el expediente pero no
  cuentan para la cobertura.
- **Especies como catálogo:** reemplazar el enum `perro | gato | otro` por una tabla
  `especies` (perro, gato, conejo, hurón, ave, reptil, otro) con su relación al esquema de
  vacunación. Solo perro y gato tienen esquema en Costa Rica; las demás muestran el expediente
  sin cobertura.
- **Sesión:** mover el refresh token de `localStorage` a una cookie `httpOnly`.
- **Textos:** unificar el trato a "tú" en toda la interfaz (hoy se mezcla con "vos").

## Fase 2: rediseño de la interfaz

**Objetivo:** que Vetify se vea como un producto con identidad, no como una plantilla. Se
conserva la base (papel y negro cálido, serif editorial, acento dorado solo en lo accionable)
pero se le da carácter.

1. **Dirección visual primero, código después.** Dos o tres propuestas de la pantalla
   "Mis mascotas" y del perfil de la mascota, se elige una y se documenta en `ui-spec.md`
   (versión 2) antes de tocar componentes.
2. **La mascota como protagonista:** foto (pendiente desde el avance) en el centro del perfil,
   identidad propia por mascota, estado de salud resumido de un vistazo.
3. **Jerarquía real:** tarjetas con profundidad, cifras grandes donde importan (próxima dosis,
   cobertura, peso), menos listas planas.
4. **Visualizaciones con carácter:** cobertura del esquema, línea de tiempo del expediente y
   curva de peso diseñadas, no gráficas por defecto.
5. **Movimiento:** transiciones entre pantallas y microinteracciones al registrar o revocar.
6. **Portal clínico usable en el teléfono:** barra de pestañas inferior como la del dueño, y
   escritorio con tabla de pacientes y agenda.
7. **Componentes:** reemplazar los `<select>` nativos por el `Select` de shadcn, estados vacíos
   ilustrados, esqueletos de carga.
8. Recorrido completo en teléfono y escritorio, claro y oscuro, y capturas nuevas.

## Fase 3: carné QR, PDF y notificaciones

- **Carné QR:** el API firma un token (`solo_carne`) y la ruta pública `/verificar/[token]`
  muestra solo la vigencia de vacunas. El token nunca se arma en el cliente.
- **PDF** del expediente con jsPDF.
- **Notificaciones push** (VAPID) de los avisos que ya se calculan.
- Edición del perfil de la mascota en la interfaz (hoy solo existe en el API).

## Fase 4: analítica e IA

- **Analítica:** curva de peso contra el rango esperado por especie y raza, frecuencia y motivo
  de consultas, adherencia a la vacunación por clínica.
- **IA (módulo `ia`):** detección de anomalías de peso, clasificación del motivo de consulta y
  resumen previo a la consulta para el veterinario. Cada resultado guarda su confianza en
  `anomalias`.

## Fase 5: cierre

- Documento final del proyecto (propuesta desarrollada, modelo de datos, decisiones).
- Manual técnico (arquitectura, instalación, despliegue, API) y manual de usuario (dueño y
  clínica, con capturas del rediseño).
- Guion y ensayo de la defensa con los datos de demostración en producción.

---

## Procedimiento para cada pieza

1. **Modelo** primero: `schema.prisma` y migración, y actualizar `docs/MODELO_DATOS.md`.
2. **Contrato** después: esquema Zod en `packages/types`.
3. **Módulo del API:** controlador sin lógica, servicio con la lógica y **toda** la autorización.
4. **Pruebas**, incluyendo el caso denegado (clínica sin permiso recibe `403`).
5. **Pantalla:** hook de TanStack Query, componente, estados de carga, error, vacío y sin
   conexión.
6. `pnpm turbo run lint typecheck test build` en verde antes de hacer commit.
