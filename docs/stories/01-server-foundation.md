# Story 1: Server Foundation — How It Works

## Structure

```
server/src/
  db/index.ts          — connection + full schema (CREATE TABLE IF NOT EXISTS)
  types/<domain>/       — Category.ts, CreateCategoryDto.ts, UpdateCategoryDto.ts, index.ts (barrel)
  types/index.ts         — re-exports every domain barrel
```

## Concept: barrel exports

Each domain folder (`types/category/`, `types/transaction/`, ...) has its own `index.ts` that does:

```ts
export * from './Category';
export * from './CreateCategoryDto';
export * from './UpdateCategoryDto';
```

And the top-level `types/index.ts` re-exports every domain barrel:

```ts
export * from './category';
export * from './transaction';
export * from './recurringTransaction';
export * from './dashboard';
```

This means any consumer anywhere in the server can write `import type { Category } from '../types'` without knowing (or caring) that `Category` actually lives in `types/category/Category.ts`. Add a new domain — say `types/department/`— and it's one new folder plus one new line in the top-level barrel; nothing that already imports from `'../types'` needs to change.

## Concept: `CREATE TABLE IF NOT EXISTS` as a lightweight migration strategy

```ts
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ...
    start_on TEXT NOT NULL DEFAULT (date('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_transactions_category_id_date ON transactions(category_id, date);
`);
```

This runs on every server start. For a schema that doesn't change shape after deploy, `IF NOT EXISTS` is enough — it's idempotent, so re-running it against an already-initialized database is a no-op. It stops being enough the moment an *existing* table needs a new column added after it already has rows (SQLite's `ALTER TABLE ADD COLUMN` can't use a non-constant default the way `CREATE TABLE` can) — that's the point where a real migration step would replace this, not before.

## Concept: indexing foreign keys explicitly

SQLite auto-indexes the primary key of every table, but **never** foreign keys. Every column that appears in a `WHERE` or `JOIN` needs its own explicit index:

```sql
CREATE INDEX idx_transactions_category_id_date ON transactions(category_id, date);
CREATE INDEX idx_transactions_recurring_transaction_id ON transactions(recurring_transaction_id);
CREATE INDEX idx_recurring_transactions_category_id ON recurring_transactions(category_id);
```

The `transactions` index is a *compound* index on `(category_id, date)` rather than two separate single-column indexes, because the dashboard's actual query pattern is "sum amounts for this category within this date range" — both columns are filtered together, so one compound index serves it directly (verified with `EXPLAIN QUERY PLAN` showing `SEARCH ... USING INDEX` rather than `SCAN`).
