---
sidebar_position: 1
title: Convenciones
---

# Convenciones del API

- **Base:** `http://localhost:3001/api` en desarrollo. Todas las rutas llevan el prefijo `/api`.
- **Formato:** JSON en la petición y en la respuesta.
- **Idioma:** rutas, campos y mensajes en español (`mascotas`, `fechaAplicacion`, `mensaje`).
- **Identificadores:** UUID.
- **Fechas sin hora** (aplicación de una vacuna, nacimiento): `AAAA-MM-DD`. Se interpretan en
  la zona horaria de Costa Rica; "hoy" para el API es el día en Costa Rica, no en UTC.
- **Marcas de tiempo** (fecha de una consulta, de un acceso): ISO 8601 con zona,
  `2026-10-07T23:41:00.000Z`.
- **Autenticación:** `Authorization: Bearer <accessToken>` en todo excepto registro, inicio de
  sesión y refresco. Ver [Autenticación](./autenticacion.md).
- **Errores:** siempre `{ "mensaje": "...", "errores": [...] }`. Ver [Errores](./errores.md).

## Límite de tasa

| Rutas                                                             | Límite         |
| ----------------------------------------------------------------- | -------------- |
| `POST /auth/registrar`, `/auth/iniciar-sesion`, `/auth/refrescar` | 10 por minuto  |
| Todo lo demás                                                     | 120 por minuto |

Al pasarlo, el API responde `429`.

## Validación

Las entradas se validan con los esquemas Zod de `@vetify/types`, los mismos que usa la web.
Los campos desconocidos se descartan y los opcionales pueden omitirse. Una entrada inválida
devuelve `400` con un mensaje por campo.
