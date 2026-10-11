import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, PoolClient, QueryResult, QueryResultRow, types } from 'pg';

// COUNT and cents are returned as numbers only while safely representable.
types.setTypeParser(20, (value) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error('Database integer exceeds safe numeric range');
  return number;
});
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL must be set');
const url = new URL(connectionString);
const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
// Configure TLS explicitly rather than letting URL sslmode replace pg options.
for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
const schema = process.env.DB_SCHEMA;
if (schema && !/^budget_test_[a-z0-9_]+$/.test(schema)) throw new Error('Invalid isolated test schema');
export const pool = new Pool({
  connectionString: url.toString(),
  ssl: local ? false : { rejectUnauthorized: true },
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  options: schema ? `-c search_path=${schema},public` : undefined,
});
pool.on('error', () => { console.error('PostgreSQL idle connection failed'); });
const context = new AsyncLocalStorage<PoolClient>();
export async function query<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []): Promise<QueryResult<T>> {
  return (context.getStore() ?? pool).query<T>(sql, values);
}
export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const existing = context.getStore();
  if (existing) return callback(existing);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await context.run(client, () => callback(client));
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
// Small parameterized SQL helpers for the existing repositories (no ORM).
function parameters(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}
const db = {
  query,
  async all(sql: string, ...values: unknown[]): Promise<any[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
    return (await query(parameters(sql), values)).rows;
  },
  async get(sql: string, ...values: unknown[]): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
    return (await query(parameters(sql), values)).rows[0];
  },
  async run(sql: string, ...values: unknown[]): Promise<{ changes: number; lastInsertRowid: number }> {
    const insert = /^\s*INSERT\s+INTO\s+(\w+)/i.exec(sql);
    const hasId = insert && !['department_access', 'schema_migrations'].includes(insert[1]);
    const result = await query(parameters(sql) + (hasId && !/RETURNING/i.test(sql) ? ' RETURNING id' : ''), values);
    return { changes: result.rowCount ?? 0, lastInsertRowid: result.rows[0]?.id };
  },
  async exec(sql: string): Promise<void> { await query(sql); },
  transaction<F extends (...args: any[]) => any>(callback: F): (...args: Parameters<F>) => Promise<Awaited<ReturnType<F>>> { // eslint-disable-line @typescript-eslint/no-explicit-any
    return (...args) => transaction(async () => callback(...args));
  },
  async close(): Promise<void> { await pool.end(); },
};
export default db;
