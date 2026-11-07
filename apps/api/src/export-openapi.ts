/**
 * Writes the OpenAPI document for the docs site's API reference
 * (apps/docs/static/openapi.json), without a database or a server.
 *
 *   pnpm --filter @vetify/api openapi
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Configuration is validated when AppModule is imported; placeholders are
// enough because `preview` mode connects to nothing.
process.env.DATABASE_URL ??= 'postgresql://localhost:5432/openapi';
process.env.JWT_ACCESS_SECRET ??= 'x'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'x'.repeat(32);
process.env.LINK_CODE_SECRET ??= 'x'.repeat(32);

const { VersioningType } = await import('@nestjs/common');
const { NestFactory } = await import('@nestjs/core');
const { AppModule } = await import('./app.module.js');
const { createOpenApiDocument } = await import('./openapi.js');

// `preview` builds the module graph without instantiating providers: no
// PostgreSQL connection and no startup side effects.
const app = await NestFactory.create(AppModule, {
  preview: true,
  logger: false,
});
app.setGlobalPrefix('api');
app.enableVersioning({ type: VersioningType.URI, prefix: 'v' });

// A fixed destination: the output path is never taken from the command line.
const target = fileURLToPath(
  new URL('../../docs/static/openapi.json', import.meta.url),
);
await writeFile(
  target,
  `${JSON.stringify(createOpenApiDocument(app), null, 2)}\n`,
);
await app.close();
console.log(`OpenAPI written to ${target}`);
