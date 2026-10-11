// One-shot transfer from an upgraded snapshot; the source is never changed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { pool, transaction } from './index';
import { migrate } from './migrate';

export async function importSqlite(source: string): Promise<void> {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-transfer-'));
  const snapshot = path.join(directory, 'snapshot.sqlite');
  try {
    const original = new Database(source, { readonly: true, fileMustExist: true });
    try { await original.backup(snapshot); } finally { original.close(); }
    process.env.SQLITE_UPGRADE_PATH = snapshot;
    // Applies the original, version-marked SQLite upgrades on the copy.
    const sqlite = (await import('./legacySqlite')).default;
    try {
      const tables = (sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('sqlite_sequence','schema_migrations') ORDER BY rowid").all() as { name: string }[]).map((r) => r.name);
      const data = tables.map((name) => ({ name, rows: sqlite.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all() as Record<string, unknown>[] }));
      const fingerprint = createHash('sha256').update(JSON.stringify(data)).digest('hex');
      await migrate();
      await transaction(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(73102512)');
        await client.query('CREATE TABLE IF NOT EXISTS sqlite_imports (fingerprint TEXT PRIMARY KEY, imported_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP)');
        const imported = (await client.query('SELECT 1 FROM sqlite_imports WHERE fingerprint=$1', [fingerprint])).rowCount;
        if (!imported) {
          for (const { name } of data) {
            if ((await client.query(`SELECT COUNT(*) AS count FROM "${name}"`)).rows[0].count !== 0) throw new Error('Import requires an empty target database');
          }
          for (const { name, rows } of data) for (const row of rows) {
            const columns = Object.keys(row);
            await client.query(`INSERT INTO "${name}" (${columns.map((c) => `"${c}"`).join(',')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')})`, Object.values(row));
          }
        }
        // Compare every transferred value: identifiers, passwords, memberships,
        // relationships, dates and monetary amounts; FK checks also run on insert.
        for (const { name, rows } of data) {
          const count = Number((await client.query(`SELECT COUNT(*) AS count FROM "${name}"`)).rows[0].count);
          if (count !== rows.length) throw new Error(`Import row-count verification failed: ${name}`);
          for (const row of rows) {
            const key = 'id' in row ? ['id'] : ['user_id', 'department_id'];
            const target = (await client.query(`SELECT ${Object.keys(row).map((c) => `"${c}"`).join(',')} FROM "${name}" WHERE ${key.map((c, i) => `"${c}"=$${i + 1}`).join(' AND ')}`, key.map((c) => row[c]))).rows[0];
            if (!target || Object.entries(row).some(([key, value]) => target[key] !== value)) throw new Error(`Import value verification failed: ${name}`);
          }
          if (rows.some((row) => 'id' in row)) await client.query(`SELECT setval(pg_get_serial_sequence($1,'id'), COALESCE((SELECT MAX(id) FROM "${name}"),1), EXISTS(SELECT 1 FROM "${name}"))`, [name]);
        }
        if (!imported) await client.query('INSERT INTO sqlite_imports(fingerprint) VALUES($1)', [fingerprint]);
      });
      console.log('SQLite import verified (counts, values, relationships and sequences)');
    } finally { sqlite.close(); }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}
if (require.main === module) {
  const source = process.argv[2];
  if (!source || source === '--help') {
    console.log('Usage: DATABASE_URL=... npm run db:import-sqlite -- /absolute/path/budget.sqlite\nTarget must be empty; rerunning the same snapshot verifies it without duplicating rows. Source remains unchanged.');
    pool.end();
    if (!source) process.exitCode = 1;
  } else {
    importSqlite(source).catch(() => { console.error('SQLite transfer failed; imported data rolled back'); process.exitCode = 1; }).finally(() => pool.end());
  }
}
