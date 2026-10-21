---
sidebar_position: 6
title: Errores
---

# Errores

Toda respuesta de error tiene la misma forma, definida como `cuerpoDeErrorSchema` en
`@vetify/types`:

```json
{
  "mensaje": "Los datos enviados no son válidos",
  "errores": [
    {
      "campo": "contrasena",
      "mensaje": "La contraseña debe tener al menos 10 caracteres"
    },
    { "campo": "correo", "mensaje": "Correo electrónico inválido" }
  ]
}
```

`errores` aparece solo en los `400` de validación; `mensaje` está siempre y está pensado para
mostrarse al usuario tal cual.

| Código | Cuándo                                                                                                    |
| ------ | --------------------------------------------------------------------------------------------------------- |
| `400`  | Datos inválidos, o una regla de negocio (vencimiento anterior a la aplicación, consulta de otra mascota). |
| `401`  | Sin access token, vencido o alterado; o credenciales incorrectas al iniciar sesión.                       |
| `403`  | El rol no puede hacer esto, o la clínica no tiene un permiso activo sobre la mascota.                     |
| `404`  | No existe, o la mascota no es tuya.                                                                       |
| `409`  | Ya existe una cuenta con ese correo.                                                                      |
| `429`  | Demasiados intentos. Esperá un minuto.                                                                    |
| `500`  | Error inesperado. El detalle queda en los logs del servidor, nunca en la respuesta.                       |

En la web, `ErrorDeApi` (en `src/lib/api-client.ts`) lleva el código, el mensaje y los errores
por campo, y los formularios los muestran debajo de cada campo.
