# Story 4: API Routes, Middleware & Server Entry — Why & Tradeoffs

**What shipped:** `routes/categories.ts`, `transactions.ts`, `recurringTransactions.ts`, `dashboard.ts`, `middleware/errorHandler.ts`, and `server.ts` — the HTTP surface tying everything from stories 1–3 together.

## Why centralized error handling, registered last

**Decision:** Routes handle *expected* failures inline (bad input → 400, not found → 404) as normal control flow. `errorHandler` middleware, registered after everything else, handles *unexpected* failures — DB constraint violations, unanticipated exceptions — and maps known SQLite error strings (`FOREIGN KEY constraint failed`, `UNIQUE constraint failed`, `NOT NULL constraint failed`) to clean messages, falling back to a generic 500 for anything else.

**Why:** Never leaking a raw stack trace or SQL error string to the client is a baseline security/UX concern, but the more important reason is consistency — without one central place doing this mapping, every route that could hit a constraint violation would need its own try/catch with its own message wording, and they'd drift.

## Key tradeoff: transaction lock scoped to *active* recurring series, not "any" series

**The bug this caught:** the first draft of the edit/delete guard checked only `transaction.recurring_transaction_id !== null` — meaning a transaction spawned from a series that was later *cancelled* stayed permanently locked, since it still points at that (now-inactive) `recurring_transaction_id`. The spec is explicit that this is wrong: "the lock should only apply while the series is active... a transaction from a cancelled/expired series needs to become directly editable again, or it's stuck forever."

**Fix:** the guard now looks up the referenced series and checks `series.active === 1`, not just whether the foreign key is set:

```ts
function lockedByActiveSeries(recurringTransactionId: number | null): boolean {
  if (recurringTransactionId === null) return false;
  const series = recurringRepo.findById(recurringTransactionId);
  return series !== undefined && series.active === 1;
}
```

This was caught by a test (`allows editing a transaction whose recurring series has been cancelled`) that failed against the original implementation — a concrete example of the spec's "decide up front whether editing/deleting a transaction spawned from a recurring series should be blocked server-side... pick one and enforce it in the route" guidance paying off: enforcing it server-side, and testing that enforcement, is what surfaced the gap between "locked" and "should stay locked."

## Key tradeoff: dashboard month-range validation order

`from`-only, `to`-only, both, and neither are four genuinely different cases (see spec), and the decision was to validate month format (`isValidMonth`, bounding the month component to 01–12) *before* checking `from <= to` — an out-of-range month like `2026-13` fails the format check first, so it never reaches the ordering comparison with a nonsensical value.

## Why Express's pathless `app.use((req, res) => {...})` instead of `app.get('*', ...)`

Express 5's router (`path-to-regexp` v8) dropped the bare-wildcard `'*'` syntax that Express 4 examples commonly use. Pathless middleware (`app.use(...)` with no path argument) matches everything regardless of Express major version, so the SPA fallback doesn't depend on which Express version is installed. Registered in the specific order: static files → API 404 → SPA fallback → error handler, so a typo'd `/api/*` route gets a clean JSON 404 instead of silently receiving the frontend's `index.html`.
