import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pool, transaction } from './index';

export async function migrate(): Promise<void> {
  const directory = path.join(__dirname, 'migrations');
  const files = (await fs.readdir(directory)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
  await transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(73102511)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    for (const file of files) {
      const sql = await fs.readFile(path.join(directory, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const applied = await client.query('SELECT checksum FROM schema_migrations WHERE name=$1', [file]);
      if (applied.rows.length) {
        if (applied.rows[0].checksum !== checksum) throw new Error(`Applied migration changed: ${file}`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [file, checksum]);
    }
  });
}
if (require.main === module) {
  migrate().then(() => { console.log('Database migrations complete'); }).catch(() => {
    console.error('Database migration failed; schema unchanged'); process.exitCode = 1;
  }).finally(() => pool.end());
}
