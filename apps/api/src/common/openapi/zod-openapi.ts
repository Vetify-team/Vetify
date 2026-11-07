import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiBody, ApiResponse, type OpenAPIObject } from '@nestjs/swagger';
import { apiErrorSchema } from '@vetify/types';
import { toJSONSchema, type ZodType } from 'zod';

/**
 * Documents endpoints with the same @vetify/types Zod schemas that validate
 * the input. The contract is written once; Swagger, Scalar and the docs site
 * read it from here, without duplicated DTOs.
 *
 * Each schema is registered under a name and becomes an OpenAPI component
 * (`#/components/schemas/<Name>`), so the reference shows named models.
 */

type JsonSchema = Record<string, unknown>;

const components = new Map<string, JsonSchema>();

/** Regexes of well-known formats only add noise to the reference. */
const clean = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(clean);
  if (!node || typeof node !== 'object') return node;
  const entry = node as JsonSchema;
  return Object.fromEntries(
    Object.entries(entry)
      .filter(([key]) => !(key === 'pattern' && 'format' in entry))
      .filter(([key]) => key !== '$schema')
      .map(([key, value]) => [key, clean(value)]),
  );
};

/** `input` describes what is sent (defaults are optional); `output`, what is returned. */
const reference = (
  name: string,
  schema: ZodType,
  use: 'input' | 'output',
): JsonSchema => {
  if (!components.has(name)) {
    components.set(
      name,
      clean(
        toJSONSchema(schema, {
          target: 'openapi-3.0',
          io: use,
          unrepresentable: 'any',
        }),
      ) as JsonSchema,
    );
  }
  return { $ref: `#/components/schemas/${name}` };
};

/** Request body, validated by ZodValidationPipe with the same schema. */
export const ZodBody = (name: string, schema: ZodType) =>
  ApiBody({ schema: reference(name, schema, 'input') });

/** Successful response. With `list`, an array of the schema. */
export const ZodResponse = (
  name: string,
  schema: ZodType,
  options: { status?: number; description?: string; list?: boolean } = {},
) => {
  const ref = reference(name, schema, 'output');
  return ApiResponse({
    status: options.status ?? HttpStatus.OK,
    description: options.description ?? 'Success',
    schema: options.list ? { type: 'array', items: ref } : ref,
  });
};

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: '`VALIDATION_FAILED` (with one message per field) or another bad request.',
  401: '`UNAUTHENTICATED`, `INVALID_CREDENTIALS` or `SESSION_EXPIRED`.',
  403: '`FORBIDDEN`: wrong role, or the clinic has no active permission on the pet.',
  404: "`NOT_FOUND`. An owner is never told that someone else's pet exists.",
  409: '`EMAIL_TAKEN` or `IDEMPOTENCY_CONFLICT`.',
  415: '`BAD_REQUEST`: credential endpoints require application/json.',
  429: '`RATE_LIMITED`: too many attempts, wait a minute.',
};

/** Error responses, all shaped as `ApiError`. */
export const ErrorResponses = (
  ...statuses: (keyof typeof ERROR_DESCRIPTIONS)[]
) =>
  applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: ERROR_DESCRIPTIONS[status],
        schema: reference('ApiError', apiErrorSchema, 'output'),
      }),
    ),
  );

/** Adds the components registered by the decorators to the document. */
export function addComponents(document: OpenAPIObject): OpenAPIObject {
  document.components ??= {};
  document.components.schemas = {
    ...document.components.schemas,
    ...Object.fromEntries(components),
  };
  return document;
}
