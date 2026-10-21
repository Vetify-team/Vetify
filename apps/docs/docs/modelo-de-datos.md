---
sidebar_position: 5
title: Modelo de datos
---

# Modelo de datos

PostgreSQL con Prisma. Las tablas y columnas están en español (`mascotas`, `fecha_aplicacion`);
en el cliente de Prisma los campos van en camelCase. La fuente de verdad es
`apps/api/prisma/schema.prisma`, con sus migraciones en `apps/api/prisma/migrations/`.

## Cuentas y roles

| Tabla               | Qué guarda                                                                |
| ------------------- | ------------------------------------------------------------------------- |
| `usuarios`          | Cuenta, rol (`dueño` o `clinica`) y hash argon2 de la contraseña.         |
| `sesiones_refresco` | Un registro por sesión: hash del refresh token, vencimiento y revocación. |
| `clinicas`          | Clínica: nombre, dirección, país, plan.                                   |
| `clinica_personal`  | Qué usuarios trabajan en qué clínica.                                     |

## El expediente

| Tabla                    | Qué guarda                                               | Lo escribe |
| ------------------------ | -------------------------------------------------------- | ---------- |
| `mascotas`               | Perfil del animal.                                       | Dueño      |
| `consultas`              | Motivo, diagnóstico y notas, con clínica y veterinario.  | Clínica    |
| `vacunas`                | Tipo, lote, aplicación y vencimiento.                    | Clínica    |
| `desparasitaciones`      | Producto, tipo, fecha y próxima dosis.                   | Clínica    |
| `tratamientos`           | Descripción, inicio y fin; puede referir a una consulta. | Clínica    |
| `examenes`               | Tipo, fecha, resultado y archivo.                        | Clínica    |
| `registros_peso`         | Serie de peso.                                           | Dueño      |
| `registros_alimentacion` | Alimentación y observaciones.                            | Dueño      |

## Reglas de negocio

| Tabla                 | Qué guarda                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| `esquemas_vacunacion` | Reglas por país, especie y edad.                                                                    |
| `permisos`            | Consentimiento dueño → clínica: alcance y estado (`activo`, `revocado`). Uno por mascota y clínica. |
| `bitacora_accesos`    | Cada acceso al expediente. Solo se inserta y se lee.                                                |
| `recordatorios`       | Avisos programados (vencimientos y próximas dosis).                                                 |
| `anomalias`           | Hallazgos del módulo de IA.                                                                         |

## Relaciones

- Un dueño tiene muchas mascotas; cada mascota tiene muchos registros de cada tipo.
- Una clínica llega a una mascota **solo** a través de un registro de `permisos` activo.
- Borrar una mascota borra en cascada su expediente, permisos y bitácora.
