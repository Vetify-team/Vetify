# Modelo de datos — Vetify

Base: **PostgreSQL** en Supabase. La fuente de verdad es
[`../supabase/schema.sql`](../supabase/schema.sql). El modelo se organiza en tres ejes.

## Cuentas y roles
| Entidad | Descripción | Campos clave |
|---|---|---|
| `usuarios` | Cuenta y rol (dueño / clínica) ligada a `auth.users`. | id, correo, nombre, rol, telefono |
| `clinicas` | Consultorio veterinario. | id, nombre, direccion, pais, plan, cantidad_veterinarios |
| `clinica_personal` | Veterinarios de cada clínica. | clinica_id, usuario_id, cargo |

## Expediente de la mascota
| Entidad | Descripción | Campos clave |
|---|---|---|
| `mascotas` | Perfil del animal (propiedad del dueño). | dueño_id, especie, raza, sexo, fecha_nacimiento, esterilizado, microchip |
| `consultas` | Acto médico. | mascota_id, clinica_id, veterinario_id, fecha, motivo, diagnostico |
| `vacunas` | Dosis aplicadas. | mascota_id, tipo, lote, fecha_aplicacion, fecha_vencimiento |
| `desparasitaciones` | Interna/externa. | mascota_id, producto, fecha, proxima_fecha |
| `tratamientos` | Medicación y seguimiento. | consulta_id, mascota_id, descripcion, inicio, fin |
| `examenes` | Resultados y archivos. | mascota_id, tipo, fecha, archivo_url |
| `registros_peso` | Serie de peso (analítica/IA). | mascota_id, fecha, peso_kg |
| `registros_alimentacion` | Alimentación y observaciones. | mascota_id, fecha, detalle |

## Reglas de negocio y seguridad
| Entidad | Descripción | Campos clave |
|---|---|---|
| `esquemas_vacunacion` | Reglas por país/especie/edad. | pais, especie, vacuna, intervalo_meses, vigencia_meses |
| `permisos` | Consentimiento dueño→clínica, revocable. | mascota_id, clinica_id, alcance, estado |
| `bitacora_accesos` | Registro de cada acceso al expediente. | mascota_id, usuario_id, accion, fecha |
| `recordatorios` | Avisos programados. | mascota_id, tipo, fecha_objetivo, canal, estado |
| `anomalias` | Hallazgos del módulo de IA. | mascota_id, tipo, severidad, confianza |

## Relaciones principales
- Un `usuario` (dueño) **1→N** `mascotas`.
- Una `mascota` **1→N** eventos clínicos (`consultas`, `vacunas`, `desparasitaciones`,
  `examenes`, `registros_peso`, `registros_alimentacion`).
- Una `clinica` accede a una `mascota` **solo** a través de un `permiso` activo.
- Cada acceso al expediente deja un registro en `bitacora_accesos`.

## Seguridad (autorización en el API)
La autorización se aplica en el **API NestJS**: el dueño gestiona sus mascotas; una clínica solo
accede a una mascota si existe un `permiso` activo para una clínica a la que pertenece el usuario.
Cada acceso al expediente se registra en `bitacora_accesos`. `supabase/schema.sql` incluye además
políticas RLS de ejemplo por si se decide reforzar la seguridad a nivel de base de datos.

> Nota: `supabase/schema.sql` es el modelo de referencia en SQL. En el API se traduce a
> `api/prisma/schema.prisma` (mismas tablas y relaciones) y Prisma gestiona las migraciones.
