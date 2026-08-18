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
    const categoryId = raw
      .prepare('INSERT INTO categories (name, budgeted_amount) VALUES (?, ?)')
      .run('Software', 500).lastInsertRowid as number;
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
    const categoryId = first.default
      .prepare('INSERT INTO categories (name, budgeted_amount) VALUES (?, ?)')
      .run('Software', 500).lastInsertRowid as number;
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
