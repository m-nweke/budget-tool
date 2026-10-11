import { beforeEach, afterAll } from 'vitest';
import { Pool } from 'pg';
import { randomBytes } from 'node:crypto';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('TEST_DATABASE_URL must point to a disposable local PostgreSQL database');
const url = new URL(databaseUrl);
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname) || !/test/i.test(url.pathname)) {
  throw new Error('Tests require a local database with test in its name');
}
const schema = `budget_test_${randomBytes(10).toString('hex')}`;
process.env.DATABASE_URL = databaseUrl;
process.env.DB_SCHEMA = schema;
const admin = new Pool({ connectionString: databaseUrl, max: 1 });
await admin.query(`CREATE SCHEMA ${schema}`);
const { migrate } = await import('./db/migrate');
const { pool } = await import('./db');
await migrate();
beforeEach(async () => {
  const tables = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname=$1 AND tablename<>'schema_migrations'", [schema]);
  if (tables.rows.length) await pool.query(`TRUNCATE ${tables.rows.map((r) => `"${r.tablename}"`).join(',')} RESTART IDENTITY CASCADE`);
});
afterAll(async () => {
  await pool.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
});
