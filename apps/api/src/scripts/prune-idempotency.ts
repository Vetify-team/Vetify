/** Run hourly against the intended environment to physically delete expired retry results. */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
try {
  let removed = 0;
  // Bound each statement and this invocation; rerun if the backlog reaches the cap.
  for (let batch = 0; batch < 100; batch++) {
    const count =
      await prisma.$executeRaw`DELETE FROM idempotency_results WHERE (user_id, scope, key_hash) IN (
      SELECT user_id, scope, key_hash FROM idempotency_results
      WHERE expires_at <= now() ORDER BY expires_at LIMIT 1000
    )`;
    removed += count;
    if (count < 1000) break;
  }
  console.log(`Removed ${removed} expired retry results`);
} finally {
  await prisma.$disconnect();
}
