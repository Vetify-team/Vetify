import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { agregarComponentes } from './common/openapi/zod-openapi.js';

const DESCRIPCION = `
Expediente clínico compartido de mascotas. **El expediente pertenece al dueño**; una clínica
accede solo con un permiso activo que el dueño puede revocar, y todo acceso queda en bitácora.

## Autenticación

1. \`POST /auth/registrar\` o \`POST /auth/iniciar-sesion\` devuelven un **access token** (15 min)
   y un **refresh token** (30 días).
2. Enviá el access token como \`Authorization: Bearer <token>\`.
3. Cuando el API responda \`401\`, llamá a \`POST /auth/refrescar\`: devuelve un par nuevo y el
   refresh token anterior deja de servir. Reusar uno ya rotado cierra todas las sesiones.

## Quién puede hacer qué

| Operación | Dueño de la mascota | Clínica con permiso activo |
| --- | --- | --- |
| Ver perfil, expediente y esquema | ✓ | ✓ |
| Acto médico: consultas, vacunas, desparasitaciones, tratamientos, exámenes | — | ✓ |
| Día a día: peso y alimentación | ✓ | — |
| Editar la mascota, permisos y bitácora | ✓ | — |

Una clínica sin permiso activo recibe \`403\`. A un dueño que no es el de la mascota se le
responde \`404\`, para no revelar que existe.

## Errores

Todas las respuestas de error tienen la forma \`{ "mensaje": "...", "errores": [...] }\`;
\`errores\` solo aparece en los \`400\` de validación.
`.trim();

/** Documento OpenAPI del API. Lo usan Scalar (en vivo) y el sitio de documentación. */
export function crearDocumentoOpenApi(app: INestApplication): OpenAPIObject {
  const configuracion = new DocumentBuilder()
    .setTitle('Vetify API')
    .setDescription(DESCRIPCION)
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description:
        'Access token devuelto por iniciar sesión, registrar o refrescar.',
    })
    .addServer('http://localhost:3001', 'Desarrollo local')
    .addTag('auth', 'Registro, inicio y cierre de sesión, refresco del token.')
    .addTag('mascotas', 'Perfil de cada mascota. Lo crea y edita su dueño.')
    .addTag(
      'expediente',
      'Historial, acto médico (clínica), día a día (dueño), esquema de vacunación y avisos.',
    )
    .addTag(
      'permisos',
      'Consentimiento del dueño: qué clínica accede, revocación y bitácora de accesos.',
    )
    .addTag('clinicas', 'Directorio de clínicas y clínica del usuario.')
    .build();

  return agregarComponentes(SwaggerModule.createDocument(app, configuracion));
}
