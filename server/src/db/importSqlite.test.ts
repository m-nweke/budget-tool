import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { query } from './index';

// importSqlite loads legacySqlite as a module singleton and closes it when
// done — one import per process, like the CLI. Reload it for each call.
async function runImport(file: string): Promise<void> {
  vi.resetModules();
  const { importSqlite } = await import('./importSqlite');
  const { pool } = await import('./index');
  try { await importSqlite(file); } finally { await pool.end(); }
}

// Builds a real SQLite export with the legacy schema, then imports it into
// this file's isolated PostgreSQL schema — the same path a production
// cutover takes, minus the live database.
let source: string;

beforeAll(async () => {
  source = path.join(os.tmpdir(), `budget-import-test-${Date.now()}-${Math.random()}.sqlite`);
  process.env.SQLITE_UPGRADE_PATH = source;
  vi.resetModules();
  const legacy = (await import('./legacySqlite')).default;
  const tenantId = legacy.prepare("INSERT INTO tenants (name, type, join_code) VALUES ('Acme Co', 'enterprise', 'JOIN1')").run().lastInsertRowid;
  const deptId = legacy.prepare('INSERT INTO departments (tenant_id, name) VALUES (?, ?)').run(tenantId, 'Engineering').lastInsertRowid;
  // Gapped ids: the import must keep them, not renumber.
  const userId = legacy.prepare("INSERT INTO users (id, name, email, password_hash) VALUES (42, 'Dana', 'dana@example.com', '$2b$10$hash')").run().lastInsertRowid;
  legacy.prepare("INSERT INTO tenant_memberships (user_id, tenant_id, role) VALUES (?, ?, 'department_head')").run(userId, tenantId);
  legacy.prepare('INSERT INTO department_access (user_id, department_id) VALUES (?, ?)').run(userId, deptId);
  const categoryId = legacy.prepare("INSERT INTO categories (tenant_id, name, budgeted_amount, department_id, start_on) VALUES (?, 'Software', 512.75, ?, '2026-01-01')").run(tenantId, deptId).lastInsertRowid;
  legacy.prepare("INSERT INTO transactions (amount, date, category_id, approved, created_by) VALUES (19.99, '2026-02-03', ?, 1, ?)").run(categoryId, userId);
  legacy.close();
  delete process.env.SQLITE_UPGRADE_PATH;
  vi.resetModules();
});

afterAll(() => {
  fs.rmSync(source, { force: true });
});

// One sequential test: testSetup truncates every table before each `it`.
describe('importSqlite', () => {
  it('preserves ids, hashes, relationships and amounts; is re-runnable; advances sequences', async () => {
    await runImport(source);

    expect((await query('SELECT id, email, password_hash FROM users')).rows).toEqual([
      { id: 42, email: 'dana@example.com', password_hash: '$2b$10$hash' },
    ]);
    expect((await query('SELECT user_id, role FROM tenant_memberships')).rows).toEqual([{ user_id: 42, role: 'department_head' }]);
    expect((await query('SELECT user_id FROM department_access')).rows).toEqual([{ user_id: 42 }]);
    expect((await query('SELECT budgeted_amount FROM categories')).rows).toEqual([{ budgeted_amount: 512.75 }]);
    expect((await query('SELECT amount, created_by FROM transactions')).rows).toEqual([{ amount: 19.99, created_by: 42 }]);

    // Same snapshot again: verifies instead of inserting duplicates.
    await runImport(source);
    expect((await query('SELECT COUNT(*)::int AS count FROM transactions')).rows[0].count).toBe(1);

    const inserted = await query("INSERT INTO users (name, email) VALUES ('New', 'new@example.com') RETURNING id");
    expect(inserted.rows[0].id).toBe(43);
  });

  it('refuses a populated target database', async () => {
    await query("INSERT INTO tenants (name, type) VALUES ('Existing', 'personal')");
    await expect(runImport(source)).rejects.toThrow('Import requires an empty target database');
  });
});
