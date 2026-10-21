/**
 * Escribe el documento OpenAPI en un archivo, sin base de datos ni servidor.
 * Lo usa el sitio de documentación (apps/docs) para la referencia del API.
 *
 *   pnpm --filter @vetify/api openapi
 */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// La configuración se valida al importar AppModule; acá basta con valores de
// relleno porque en modo `preview` no se conecta a nada.
process.env.DATABASE_URL ??=
  'postgresql://exportar:openapi@localhost:5432/openapi';
process.env.JWT_ACCESS_SECRET ??= 'x'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'x'.repeat(32);

const { NestFactory } = await import('@nestjs/core');
const { AppModule } = await import('./app.module.js');
const { crearDocumentoOpenApi } = await import('./openapi.js');

// `preview` arma el grafo de módulos sin instanciar proveedores: no hay
// conexión a PostgreSQL ni efectos de arranque.
const app = await NestFactory.create(AppModule, {
  preview: true,
  logger: false,
});
app.setGlobalPrefix('api');

const destino = resolve(process.argv[2] ?? 'openapi.json');
await writeFile(
  destino,
  `${JSON.stringify(crearDocumentoOpenApi(app), null, 2)}\n`,
);
await app.close();
console.log(`OpenAPI escrito en ${destino}`);
