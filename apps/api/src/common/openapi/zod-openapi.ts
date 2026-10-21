import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiBody, ApiResponse, type OpenAPIObject } from '@nestjs/swagger';
import { cuerpoDeErrorSchema } from '@vetify/types';
import { toJSONSchema, type ZodType } from 'zod';

/**
 * Documenta los endpoints con los mismos esquemas Zod de @vetify/types que
 * validan la entrada. El contrato se define una vez; Swagger, Scalar y el
 * sitio de documentación lo leen desde acá, sin DTOs duplicados.
 *
 * Cada esquema se registra con un nombre y aparece como componente del
 * OpenAPI (`#/components/schemas/<Nombre>`), así la referencia muestra
 * modelos con nombre en vez de objetos anónimos repetidos.
 */

type Esquema = Record<string, unknown>;

const componentes = new Map<string, Esquema>();

/** Las expresiones regulares de formatos conocidos solo ensucian la referencia. */
const limpiar = (nodo: unknown): unknown => {
  if (Array.isArray(nodo)) return nodo.map(limpiar);
  if (!nodo || typeof nodo !== 'object') return nodo;
  const entrada = nodo as Esquema;
  return Object.fromEntries(
    Object.entries(entrada)
      .filter(([clave]) => !(clave === 'pattern' && 'format' in entrada))
      .filter(([clave]) => clave !== '$schema')
      .map(([clave, valor]) => [clave, limpiar(valor)]),
  );
};

/**
 * `entrada` describe lo que se envía (los campos con valor por defecto son
 * opcionales); `salida`, lo que el API devuelve.
 */
const referencia = (
  nombre: string,
  esquema: ZodType,
  uso: 'entrada' | 'salida',
): Esquema => {
  if (!componentes.has(nombre)) {
    componentes.set(
      nombre,
      limpiar(
        toJSONSchema(esquema, {
          target: 'openapi-3.0',
          io: uso === 'entrada' ? 'input' : 'output',
          unrepresentable: 'any',
        }),
      ) as Esquema,
    );
  }
  return { $ref: `#/components/schemas/${nombre}` };
};

/** Cuerpo de la petición, validado por `ZodValidationPipe` con el mismo esquema. */
export const Cuerpo = (nombre: string, esquema: ZodType) =>
  ApiBody({ schema: referencia(nombre, esquema, 'entrada') });

/** Respuesta exitosa. Con `lista`, un arreglo del esquema. */
export const Respuesta = (
  nombre: string,
  esquema: ZodType,
  opciones: { estado?: number; descripcion?: string; lista?: boolean } = {},
) => {
  const ref = referencia(nombre, esquema, 'salida');
  return ApiResponse({
    status: opciones.estado ?? HttpStatus.OK,
    description: opciones.descripcion ?? 'Operación exitosa',
    schema: opciones.lista ? { type: 'array', items: ref } : ref,
  });
};

const DESCRIPCION_ERRORES: Record<number, string> = {
  400: 'Datos inválidos. `errores` trae un mensaje por campo.',
  401: 'Sin sesión, o el access token venció o fue alterado.',
  403: 'El rol no puede hacer esto, o la clínica no tiene un permiso activo sobre la mascota.',
  404: 'No existe, o no es tuya: a un dueño ajeno no se le revela que la mascota existe.',
  409: 'Ya existe (por ejemplo, el correo ya está registrado).',
  429: 'Demasiados intentos. Esperá un minuto.',
};

/** Respuestas de error, todas con la forma de `CuerpoDeError`. */
export const Errores = (...estados: (keyof typeof DESCRIPCION_ERRORES)[]) =>
  applyDecorators(
    ...estados.map((estado) =>
      ApiResponse({
        status: estado,
        description: DESCRIPCION_ERRORES[estado],
        schema: referencia('CuerpoDeError', cuerpoDeErrorSchema, 'salida'),
      }),
    ),
  );

/** Agrega al documento los componentes registrados por los decoradores. */
export function agregarComponentes(documento: OpenAPIObject): OpenAPIObject {
  documento.components ??= {};
  documento.components.schemas = {
    ...documento.components.schemas,
    ...Object.fromEntries(componentes),
  };
  return documento;
}
