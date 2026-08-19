import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

// Unlike every other test file, this one needs a real on-disk file (not
// :memory:) and genuine module reloads between "boots" — the backfill
// under test only ever runs once, at module import time, so exercising it
// means actually simulating a server restart against the same file.
let dbPath: string;
const originalDbPath = process.env.DB_PATH;

beforeEach(() => {
  dbPath = path.join(os.tmpdir(), `budget-migration-test-${Date.now()}-${Math.random()}.sqlite`);
  process.env.DB_PATH = dbPath;
  vi.resetModules();
});

afterEach(() => {
  process.env.DB_PATH = originalDbPath;
  vi.resetModules();
  fs.rmSync(dbPath, { force: true });
});

describe('backfill_approved_pre_approval_workflow', () => {
  it('backfills a legacy approved=0/needs_approval=0 transaction on the boot where it is first found', async () => {
    // Boot 1: creates the schema and runs the migration against empty
    // tables (a no-op — nothing to backfill yet, but the marker gets set).
    const first = await import('./index');
    first.default.close();

    // Between boots: insert a transaction shaped exactly like every row
    // created before this migration existed, and remove the marker so the
    // next boot re-runs the backfill — simulating "this legacy data
    // predates the migration ever having run."
    const raw = new Database(dbPath);
    const tenantId = raw
      .prepare("INSERT INTO tenants (name, type) VALUES ('Acme Co', 'enterprise')")
      .run().lastInsertRowid as number;
    const categoryId = raw
      .prepare('INSERT INTO categories (name, budgeted_amount, tenant_id) VALUES (?, ?, ?)')
      .run('Software', 500, tenantId).lastInsertRowid as number;
    const txId = raw
      .prepare(
        'INSERT INTO transactions (amount, date, category_id, needs_approval, approved) VALUES (?, ?, ?, 0, 0)'
      )
      .run(50, '2026-01-01', categoryId).lastInsertRowid as number;
    raw.prepare("DELETE FROM schema_migrations WHERE name = 'backfill_approved_pre_approval_workflow'").run();
    raw.close();

    // Boot 2: the migration finds no marker, so it re-runs and backfills
    // the legacy row.
    vi.resetModules();
    const second = await import('./index');
    const row = second.default.prepare('SELECT approved, needs_approval FROM transactions WHERE id = ?').get(txId);
    expect(row).toEqual({ approved: 1, needs_approval: 0 });
    second.default.close();
  });

  it('does not touch a genuinely rejected transaction on a later restart', async () => {
    // Boot 1: schema created, marker set (nothing to backfill).
    const first = await import('./index');
    const tenantId = first.default
      .prepare("INSERT INTO tenants (name, type) VALUES ('Acme Co', 'enterprise')")
      .run().lastInsertRowid as number;
    const categoryId = first.default
      .prepare('INSERT INTO categories (name, budgeted_amount, tenant_id) VALUES (?, ?, ?)')
      .run('Software', 500, tenantId).lastInsertRowid as number;
    const txId = first.default
      .prepare(
        'INSERT INTO transactions (amount, date, category_id, needs_approval, approved) VALUES (?, ?, ?, 1, 0)'
      )
      .run(250, '2026-01-01', categoryId).lastInsertRowid as number;
    // A real rejection — same final shape (approved=0, needs_approval=0)
    // the legacy backfill targets, but reached via an actual decision.
    first.default.prepare('UPDATE transactions SET approved = 0, needs_approval = 0 WHERE id = ?').run(txId);
    first.default.close();

    // Boot 2: simulates a server restart against the same file, marker
    // already present from boot 1 — the migration must be a no-op here,
    // or it would silently un-reject this transaction.
    vi.resetModules();
    const second = await import('./index');
    const row = second.default.prepare('SELECT approved, needs_approval FROM transactions WHERE id = ?').get(txId);
    expect(row).toEqual({ approved: 0, needs_approval: 0 });
    second.default.close();
  });
});

describe('migrate_users_and_departments_to_tenants', () => {
  // Builds the pre-story-15 schema directly (role/department_id inline on
  // users, no tenants/tenant_memberships tables, no tenant_id on
  // departments/categories) — this is what every real database looked
  // like before this migration existed, and index.ts's current schema no
  // longer creates this shape for a fresh database, so there's no other
  // way to construct a genuinely "legacy" fixture.
  function createLegacySchema(raw: Database.Database): void {
    raw.exec(`
      CREATE TABLE departments (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'department_employee',
        department_id INTEGER REFERENCES departments(id),
        password_hash TEXT
      );
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        budgeted_amount REAL NOT NULL,
        department_id INTEGER REFERENCES departments(id),
        approval_threshold REAL
      );
      CREATE TABLE schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')));
    `);
  }

  it('backfills a default tenant, per-user memberships, and department_id/tenant_id for legacy data', async () => {
    const raw = new Database(dbPath);
    createLegacySchema(raw);
    const deptId = raw.prepare('INSERT INTO departments (name) VALUES (?)').run('Engineering').lastInsertRowid as number;
    const categoryId = raw
      .prepare('INSERT INTO categories (name, budgeted_amount, department_id) VALUES (?, ?, ?)')
      .run('Software', 500, deptId).lastInsertRowid as number;
    const headId = raw
      .prepare('INSERT INTO users (name, email, role, department_id) VALUES (?, ?, ?, ?)')
      .run('Dana Head', 'dana@example.com', 'department_head', null).lastInsertRowid as number;
    const employeeId = raw
      .prepare('INSERT INTO users (name, email, role, department_id) VALUES (?, ?, ?, ?)')
      .run('Evan Employee', 'evan@example.com', 'department_employee', deptId).lastInsertRowid as number;
    raw.close();

    const opened = await import('./index');
    const db = opened.default;

    const tenants = db.prepare('SELECT * FROM tenants').all();
    expect(tenants).toHaveLength(1);
    const tenant = tenants[0] as { id: number; name: string; type: string };
    expect(tenant).toMatchObject({ name: 'Default Company', type: 'enterprise' });

    expect(db.prepare('SELECT tenant_id FROM departments WHERE id = ?').get(deptId)).toEqual({ tenant_id: tenant.id });
    expect(db.prepare('SELECT tenant_id FROM categories WHERE id = ?').get(categoryId)).toEqual({ tenant_id: tenant.id });

    const headMembership = db
      .prepare('SELECT role, department_id FROM tenant_memberships WHERE user_id = ? AND tenant_id = ?')
      .get(headId, tenant.id);
    expect(headMembership).toEqual({ role: 'department_head', department_id: null });

    const employeeMembership = db
      .prepare('SELECT role, department_id FROM tenant_memberships WHERE user_id = ? AND tenant_id = ?')
      .get(employeeId, tenant.id);
    expect(employeeMembership).toEqual({ role: 'department_employee', department_id: deptId });

    // role/department_id are gone from users — reading them should fail,
    // not silently return undefined, since a caller reading a dropped
    // column by name would otherwise get no signal anything changed.
    expect(() => db.prepare('SELECT role FROM users WHERE id = ?').get(headId)).toThrow();
    expect(() => db.prepare('SELECT department_id FROM users WHERE id = ?').get(headId)).toThrow();

    db.close();
  });

  it('is a no-op on a fresh, empty database — no default tenant is synthesized', async () => {
    const opened = await import('./index');
    expect(opened.default.prepare('SELECT COUNT(*) AS count FROM tenants').get()).toEqual({ count: 0 });
    opened.default.close();
  });

  it('does not run twice on a restart, even with real multi-tenant data present', async () => {
    const raw = new Database(dbPath);
    createLegacySchema(raw);
    raw.prepare('INSERT INTO users (name, email, role, department_id) VALUES (?, ?, ?, ?)').run(
      'Dana Head',
      'dana@example.com',
      'department_head',
      null
    );
    raw.close();

    const first = await import('./index');
    expect(first.default.prepare('SELECT COUNT(*) AS count FROM tenants').get()).toEqual({ count: 1 });
    // Simulates real post-migration activity: a second tenant created
    // through the normal application flow (e.g. a personal signup),
    // independent of the legacy backfill.
    first.default.prepare("INSERT INTO tenants (name, type) VALUES ('Pat''s Budget', 'personal')").run();
    first.default.close();

    // Boot 2: if the migration re-ran, it would see userCount > 0 again
    // and synthesize a second 'Default Company' tenant.
    vi.resetModules();
    const second = await import('./index');
    const tenants = second.default.prepare('SELECT name, type FROM tenants').all();
    expect(tenants).toEqual([
      { name: 'Default Company', type: 'enterprise' },
      { name: "Pat's Budget", type: 'personal' },
    ]);
    second.default.close();
  });
});
