# Story 2: Repository Layer & Date Math — How It Works

## Concept: the repository layer's contract

Every repository file exports plain functions — `findAll`, `findById`, `create`, `update`, `remove`, plus table-specific queries — and is the *only* place `db.prepare(...)` is called for that table:

```ts
// categoryRepository.ts
export function countTransactionsForCategory(id: number): number {
  const row = db
    .prepare('SELECT COUNT(*) as count FROM transactions WHERE category_id = ?')
    .get(id) as { count: number };
  return row.count;
}
```

A route never writes SQL. It calls `categoryRepo.countTransactionsForCategory(id)` and gets back a typed number. This is what makes the category-delete guard (story 4) readable as two named checks instead of an inline `WHERE ... OR EXISTS (...)` buried in a route handler.

## Concept: "omitted on update = unchanged" implemented with nullish coalescing

```ts
export function update(id: number, dto: UpdateCategoryDto): Category | undefined {
  const existing = findById(id);
  if (!existing) return undefined;

  db.prepare(
    'UPDATE categories SET name = ?, budgeted_amount = ?, department_id = ?, start_on = ? WHERE id = ?'
  ).run(
    dto.name ?? existing.name,
    dto.budgeted_amount ?? existing.budgeted_amount,
    dto.department_id !== undefined ? dto.department_id : existing.department_id,
    dto.start_on !== undefined ? dto.start_on : existing.start_on,
    id
  );
  return findById(id);
}
```

Note the two different patterns here: `dto.name ?? existing.name` works for fields that are never intentionally `null`. But `department_id` and `start_on` use an explicit `!== undefined` check instead, because `??` would also replace an intentionally-set `null` (e.g. "clear this category's department") with the existing value — `??` can't distinguish "the client omitted this field" from "the client explicitly sent null." The explicit check can.

## Concept: `advanceDate` — one function, four cadences

```ts
export function advanceDate(date: string, interval: Interval): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));

  switch (interval) {
    case 'daily':    dt.setUTCDate(dt.getUTCDate() + 1);  break;
    case 'weekly':   dt.setUTCDate(dt.getUTCDate() + 7);  break;
    case 'biweekly': dt.setUTCDate(dt.getUTCDate() + 14); break;
    case 'monthly':  dt.setUTCMonth(dt.getUTCMonth() + 1); break;
  }
  return toDateString(dt);
}
```

Using `Date.UTC(...)` to construct the date and `setUTCDate`/`setUTCMonth` to advance it means JavaScript's own calendar math (leap years, month-length differences, year rollovers) does the heavy lifting — the function never manually computes "does this month have 30 or 31 days." The one subtlety worth knowing: `setUTCMonth` on Jan 31 doesn't error on the (nonexistent) Feb 31 — it rolls forward into March, giving `2026-03-03`. That's a deliberate, tested behavior (see `dateMath.test.ts`), not an oversight — it's the same rollover behavior most calendar libraries use, but a consumer relying on this needs to know a monthly recurrence starting on the 31st won't always land on the 31st.

## Concept: `monthCount` for dashboard budget scaling

```ts
export function monthCount(from: string, to: string): number {
  const a = parseMonth(from);
  const b = parseMonth(to);
  return (b.year - a.year) * 12 + (b.month - a.month) + 1;
}
```

Converts the year/month difference into a flat month count, inclusive of both endpoints (`2026-01` to `2026-03` → 3). The dashboard route multiplies each category's `budgeted_amount` by this to answer "what was the total budget across this range" — see story 4 for how that combines with a category's own `start_on` to handle a category that didn't exist for the whole requested range.
