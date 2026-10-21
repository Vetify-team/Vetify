import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { addComponents } from './common/openapi/zod-openapi.js';

const DESCRIPTION = `
Shared clinical record for pets. **The record belongs to the owner**; a clinic gets access only
through an active permission the owner can revoke, and every access is written to an audit log.

## Versioning

Every resource lives under a version. Use either form:

- In the URL: \`/api/v1/pets\`
- In a header: \`/api/pets\` with \`X-API-Version: 1\`

If both are present they must agree. Responses echo \`X-API-Version\`.

## Authentication

1. \`POST /api/v1/auth/register\` or \`POST /api/v1/auth/login\` return an **access token** (15 min)
   in the body and set the **refresh token** in an \`HttpOnly\`, \`SameSite=Strict\` cookie.
2. Send the access token as \`Authorization: Bearer <token>\`.
3. On \`401\`, call \`POST /api/v1/auth/refresh\` (the cookie goes automatically): it returns a new
   access token and rotates the cookie. Replaying a rotated refresh token revokes every session.
4. \`POST /api/v1/auth/logout\` revokes the session; its access tokens stop working immediately.

## Who can do what

| Operation | Pet owner | Clinic with active permission | Admin |
| --- | --- | --- | --- |
| Read profile, record and schedule | ✓ | ✓ | — |
| Medical acts: consultations, vaccinations, dewormings, treatments, exams | — | ✓ | — |
| Day to day: weight and feeding | ✓ | — | — |
| Edit the pet, manage permissions, read the access log | ✓ | — | — |
| Verify clinics | — | — | ✓ |

A clinic without an active permission gets \`403\`. An owner asking for someone else's pet gets
\`404\`, so its existence is not revealed. Owners grant access only with a **link code** that a
**verified** clinic shows them in person.

## Errors

Every error is \`{ "code": "...", "message": "...", "errors": [...] }\`. \`code\` is stable and meant
for clients to translate; \`errors\` appears only on \`VALIDATION_FAILED\`.
`.trim();

/** OpenAPI document of the API. Used live by Scalar and exported for the docs site. */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Vetify API')
    .setDescription(DESCRIPTION)
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Access token from login, register or refresh.',
    })
    .addCookieAuth('vetify_refresh', {
      type: 'apiKey',
      in: 'cookie',
      description: 'HttpOnly refresh cookie set by the API.',
    })
    .addServer('http://localhost:3001', 'Local development')
    .addTag('auth', 'Sign-up, log-in, rotating refresh and log-out.')
    .addTag('pets', "Each pet's profile. Created and edited by its owner.")
    .addTag(
      'records',
      'History, medical acts (clinic), day to day (owner), vaccination schedule and alerts.',
    )
    .addTag(
      'permissions',
      "Owner's consent: which clinic has access, revocation and the access log.",
    )
    .addTag('clinics', "The user's clinic and link codes.")
    .addTag('admin', 'Clinic verification. Admins never access pets.')
    .addTag('health', 'Liveness probe.')
    .build();

  return addComponents(SwaggerModule.createDocument(app, config));
}
