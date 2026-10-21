---
sidebar_position: 2
title: Autenticación
---

# Autenticación

JWT con dos tokens:

| Token          | Dura       | Para qué                                                 |
| -------------- | ---------- | -------------------------------------------------------- |
| `accessToken`  | 15 minutos | Va en `Authorization: Bearer` en cada petición.          |
| `refreshToken` | 30 días    | Solo sirve para pedir un par nuevo en `/auth/refrescar`. |

Las contraseñas se guardan con **argon2** y el refresh token se guarda solo como hash.

## Registrarse

Un dueño:

```bash
curl -X POST http://localhost:3001/api/auth/registrar \
  -H "Content-Type: application/json" \
  -d '{ "correo": "ana@correo.cr", "nombre": "Ana Jiménez", "contrasena": "una-clave-larga" }'
```

Una clínica crea la clínica y su responsable en el mismo paso:

```json
{
  "correo": "recepcion@vetbrunca.cr",
  "nombre": "Dra. Laura Mora",
  "contrasena": "una-clave-larga",
  "rol": "clinica",
  "nombreClinica": "Veterinaria Brunca"
}
```

La contraseña necesita al menos 10 caracteres. Responde `201` con la sesión:

```json
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "eyJhbGciOi...",
  "usuario": {
    "id": "2f6c…",
    "correo": "ana@correo.cr",
    "nombre": "Ana Jiménez",
    "rol": "dueño",
    "telefono": null,
    "creadoEn": "2026-10-07T23:41:00.000Z"
  }
}
```

## Iniciar sesión

`POST /auth/iniciar-sesion` con `{ "correo", "contrasena" }` devuelve la misma sesión. Con
credenciales inválidas responde `401` con un mensaje genérico, sin decir si el correo existe; un
correo inexistente tarda lo mismo que una contraseña incorrecta.

## Mantener la sesión

Cuando una petición devuelve `401`, el access token venció:

```bash
curl -X POST http://localhost:3001/api/auth/refrescar \
  -H "Content-Type: application/json" \
  -d '{ "refreshToken": "eyJhbGciOi..." }'
```

Devuelve un **par nuevo** y el refresh token enviado **deja de servir** (rotación). Guardá
siempre el último.

:::warning Reutilizar un refresh token cierra todas las sesiones
Si llega un refresh token que ya fue rotado, alguien lo copió. El API revoca **todas** las
sesiones del usuario, que tendrá que volver a iniciar sesión en cada dispositivo.
:::

Si dos refrescos con el mismo token llegan a la vez, solo uno gana; el otro recibe `401`.
El cliente web comparte una sola promesa de refresco entre las peticiones concurrentes para
evitarlo.

## Cerrar sesión

`POST /auth/cerrar-sesion`, con el access token y `{ "refreshToken" }` en el cuerpo. Revoca la
sesión de ese dispositivo y responde `204`.

## Usuario actual

`GET /auth/yo` devuelve el usuario dueño del access token.
