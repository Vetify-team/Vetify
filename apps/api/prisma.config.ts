import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7: la URL de conexión ya no vive en schema.prisma. Aquí la usa
// Migrate; el cliente en runtime la recibe vía el adaptador de pg.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
