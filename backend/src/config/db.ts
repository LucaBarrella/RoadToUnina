import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const connectionString: string =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgrespassword@localhost:5432/roadtounina?schema=public';

const pool = new Pool({
  connectionString,
  max: 50,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});
const adapter = new PrismaPg(pool);

/**
 * Singleton instance of PrismaClient configured with PostgreSQL pg driver adapter.
 * Reused across all services and routes to maintain a managed connection pool.
 *
 * @type {PrismaClient}
 */
export const prisma: PrismaClient = new PrismaClient({ adapter });