---
name: vetify-modulo-api
description: Agregar o modificar un módulo del API NestJS de Vetify de punta a punta: modelo Prisma, migración, contrato en packages/types, módulo, autorización, Swagger y pruebas.
---

# Módulo del API de Vetify, de punta a punta

Seguir este orden. Saltarse un paso es lo que produce que el frontend y el API se desalineen.

## 1. Modelo de datos primero

- Definir o ajustar el modelo en `apps/api/prisma/schema.prisma`. Tablas y columnas **en español**.
- `pnpm --filter api exec prisma migrate dev --name <descripcion_corta>`.
- `prisma generate`.
- Actualizar la tabla correspondiente en `docs/MODELO_DATOS.md` en el mismo cambio.

## 2. Contrato antes que implementación

En `packages/types`, definir el esquema **Zod** de entrada y salida y derivar el tipo:

```ts
export const crearMascotaSchema = z.object({ ... });
export type CrearMascota = z.infer<typeof crearMascotaSchema>;
```

El API valida con ese esquema y el frontend tipa con ese tipo. Un cambio de contrato se hace **aquí**, nunca duplicado en cada app.

## 3. Módulo NestJS

En `apps/api/src/<modulo>/`: `<modulo>.module.ts`, `<modulo>.controller.ts`, `<modulo>.service.ts`, `dto/`.

- El **controlador** valida entrada y no contiene lógica de negocio.
- El **servicio** contiene la lógica y **toda** la autorización.
- Prisma se usa solo desde el servicio.

## 4. Autorización y bitácora

Antes de devolver cualquier dato del expediente, responder explícitamente:

- ¿Quién puede llamar esto: `dueño`, `clinica`, o ambos? → guard de rol.
- Si es una clínica: ¿hay un `permiso` activo para esa mascota y esa clínica? Si no, `403`.
- ¿Este acceso debe quedar en `bitacora_accesos`? Para lectura o escritura del expediente, **sí**.

Si la respuesta a alguna no es obvia, el endpoint todavía no está listo.

## 5. Swagger

Anotar con `@ApiTags`, `@ApiOperation` y los DTOs de respuesta. La documentación del API es parte del entregable del curso, no un extra.

## 6. Pruebas

- Unitarias del servicio, incluyendo **el caso denegado**: una clínica sin permiso activo debe recibir `403`. Ese es el test que demuestra el diferenciador del producto.
- E2E del endpoint feliz.

## 7. Cierre

`pnpm turbo run lint typecheck test --filter=api` en verde, y commit `feat(api): <módulo>`.
