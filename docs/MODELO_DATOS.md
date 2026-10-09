# Modelo de datos — Vetify

Base: **PostgreSQL** (Neon en producción, Docker en desarrollo). La fuente de verdad es
[`../apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma) con sus migraciones en
`apps/api/prisma/migrations/`. `supabase/schema.sql` se conserva como referencia histórica.
El modelo se organiza en tres ejes.

## Migraciones aplicadas

| Migración                | Contenido                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `inicial`                | Las 16 entidades del modelo más `sesiones_refresco`.                                |
| `esquemas_vacunacion_cr` | Catálogo de vacunas de Costa Rica para perro y gato (datos, sin cambio de esquema). |

## Cuentas y roles

| Entidad             | Descripción                                            | Campos clave                                             |
| ------------------- | ------------------------------------------------------ | -------------------------------------------------------- |
| `usuarios`          | Cuenta y rol (dueño / clínica). Contraseña con argon2. | id, correo, nombre, rol, telefono, contrasena_hash       |
| `sesiones_refresco` | Refresh tokens rotados; solo se guarda su hash.        | usuario_id, token_hash, expira_en, revocado_en           |
| `clinicas`          | Consultorio veterinario.                               | id, nombre, direccion, pais, plan, cantidad_veterinarios |
| `clinica_personal`  | Veterinarios de cada clínica.                          | clinica_id, usuario_id, cargo                            |

## Expediente de la mascota

| Entidad                  | Descripción                              | Campos clave                                                             |
| ------------------------ | ---------------------------------------- | ------------------------------------------------------------------------ |
| `mascotas`               | Perfil del animal (propiedad del dueño). | dueño_id, especie, raza, sexo, fecha_nacimiento, esterilizado, microchip |
| `consultas`              | Acto médico.                             | mascota_id, clinica_id, veterinario_id, fecha, motivo, diagnostico       |
| `vacunas`                | Dosis aplicadas.                         | mascota_id, tipo, lote, fecha_aplicacion, fecha_vencimiento              |
| `desparasitaciones`      | Interna/externa.                         | mascota_id, producto, fecha, proxima_fecha                               |
| `tratamientos`           | Medicación y seguimiento.                | consulta_id, mascota_id, descripcion, inicio, fin                        |
| `examenes`               | Resultados y archivos.                   | mascota_id, tipo, fecha, archivo_url                                     |
| `registros_peso`         | Serie de peso (analítica/IA).            | mascota_id, fecha, peso_kg                                               |
| `registros_alimentacion` | Alimentación y observaciones.            | mascota_id, fecha, detalle                                               |

## Reglas de negocio y seguridad

| Entidad               | Descripción                              | Campos clave                                           |
| --------------------- | ---------------------------------------- | ------------------------------------------------------ |
| `esquemas_vacunacion` | Reglas por país/especie/edad.            | pais, especie, vacuna, intervalo_meses, vigencia_meses |
| `permisos`            | Consentimiento dueño→clínica, revocable. | mascota_id, clinica_id, alcance, estado                |
| `bitacora_accesos`    | Registro de cada acceso al expediente.   | mascota_id, usuario_id, accion, fecha                  |
| `recordatorios`       | Avisos programados.                      | mascota_id, tipo, fecha_objetivo, canal, estado        |
| `anomalias`           | Hallazgos del módulo de IA.              | mascota_id, tipo, severidad, confianza                 |

## Relaciones principales

- Un `usuario` (dueño) **1→N** `mascotas`.
- Una `mascota` **1→N** eventos clínicos (`consultas`, `vacunas`, `desparasitaciones`,
  `examenes`, `registros_peso`, `registros_alimentacion`).
- Una `clinica` accede a una `mascota` **solo** a través de un `permiso` activo.
- Cada acceso al expediente deja un registro en `bitacora_accesos`.

## Seguridad (autorización en el API)

La autorización se aplica en el **API NestJS**: el dueño gestiona sus mascotas; una clínica solo
accede a una mascota si existe un `permiso` activo para una clínica a la que pertenece el usuario.
Cada acceso al expediente se registra en `bitacora_accesos`.

> Las políticas RLS de `supabase/schema.sql` no se trasladaron: la autorización vive en
> `PermisosService.autorizar` del API.
