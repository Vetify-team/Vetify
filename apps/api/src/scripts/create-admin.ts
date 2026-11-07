/**
 * Creates (or promotes) an admin. Admins cannot sign up through the API: they
 * are created here, on the server, by someone with database access.
 *
 *   ADMIN_EMAIL=… ADMIN_NAME=… ADMIN_PASSWORD=… pnpm --filter @vetify/api admin:create
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { passwordSchema } from '@vetify/types';
import * as argon2 from 'argon2';
import { z } from 'zod';
import { PrismaClient } from '../generated/prisma/client.js';

const input = z
  .object({
    DATABASE_URL: z.string().min(1),
    ADMIN_EMAIL: z.email(),
    ADMIN_NAME: z.string().min(1),
    ADMIN_PASSWORD: passwordSchema,
  })
  .safeParse(process.env);

if (!input.success) {
  console.error(
    input.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('\n'),
  );
  process.exit(1);
}

const { DATABASE_URL, ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD } = input.data;
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
});
const email = ADMIN_EMAIL.toLowerCase();
const passwordHash = await argon2.hash(ADMIN_PASSWORD);

await prisma.$transaction(async (tx) => {
  await tx.user.upsert({
    where: { email },
    create: { email, name: ADMIN_NAME, passwordHash, role: 'admin' },
    update: { name: ADMIN_NAME, passwordHash, role: 'admin' },
  });
  // Promoting an existing account must not keep its old sessions alive.
  // The user UPDATE holds the same row lock used by refresh/login until commit.
  await tx.refreshSession.updateMany({
    where: { user: { email }, revokedAt: null },
    data: { revokedAt: new Date() },
  });
});
await prisma.$disconnect();
console.log(`Admin ready: ${email}`);
