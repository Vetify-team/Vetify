import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7: the connection URL no longer lives in schema.prisma. Migrate uses
// it from here; at runtime the client receives it through the pg adapter.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
    // Optional: lets `prisma migrate diff --from-migrations` replay the
    // migrations on a throwaway database to compare them with the schema.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
