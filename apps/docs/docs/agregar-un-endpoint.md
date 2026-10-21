---
sidebar_position: 6
title: Agregar un endpoint
---

# Agregar un endpoint

El orden importa: saltarse un paso es lo que desalinea la web, el API y la documentación.

## 1. Modelo

Si hace falta una tabla o columna nueva, cambiá `apps/api/prisma/schema.prisma` (nombres en
español) y creá la migración:

```bash
corepack pnpm --filter @vetify/api exec prisma migrate dev --name descripcion_corta
```

## 2. Contrato

En `packages/types`, el esquema Zod de entrada y de salida, y su tipo derivado:

```ts
export const crearExamenSchema = z.object({
  tipo: z.string().max(120).optional(),
  fecha: fechaSchema,
});
export type CrearExamen = z.infer<typeof crearExamenSchema>;
```

Nunca se define el mismo tipo en otra parte.

## 3. Servicio

La lógica y **toda** la autorización van en el servicio, empezando por `autorizar`:

```ts
async registrarExamen(usuario: TokenPayload, mascotaId: string, datos: CrearExamen) {
  await this.permisos.autorizar(usuario, mascotaId, 'acto_medico');
  // …
}
```

Si la ruta lleva `:mascotaId`, la bitácora se escribe sola.

## 4. Controlador y documentación

El controlador no tiene lógica: valida con el esquema y documenta con los decoradores de
`common/openapi/zod-openapi.ts`, que convierten el mismo esquema a OpenAPI:

```ts
@Roles('clinica')
@Post('examenes')
@AccionBitacora('registrar_examen')
@ApiOperation({ summary: 'Registrar un examen' })
@Cuerpo('CrearExamen', crearExamenSchema)
@Respuesta('Examen', examenSchema, { estado: 201 })
@Errores(400, 401, 403)
registrarExamen(
  @UsuarioActual() usuario: TokenPayload,
  @Param('mascotaId', ParseUUIDPipe) mascotaId: string,
  @Body(new ZodValidationPipe(crearExamenSchema)) datos: CrearExamen,
): Promise<Examen> {
  return this.expedienteService.registrarExamen(usuario, mascotaId, datos);
}
```

El endpoint aparece de inmediato en la referencia en vivo (`/api/docs`). Para este sitio, regenerá
el archivo:

```bash
corepack pnpm --filter @vetify/api openapi
```

## 5. Pruebas

Unitarias del servicio, incluido el caso denegado: una clínica sin permiso activo tiene que
recibir `403`.

## 6. Cliente web

Agregá la llamada en `apps/web/src/lib/api-client.ts`, tipada con el contrato, y un hook de
TanStack Query en `apps/web/src/hooks`.
