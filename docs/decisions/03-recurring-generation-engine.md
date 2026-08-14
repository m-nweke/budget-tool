# Story 3: Recurring Transaction Generation Engine — Why & Tradeoffs

**What shipped:** `utils/recurringGenerator.ts` (`generateDue`, `rebuildFromScratch`, `todayString`) and its test suite — this is the most complex piece of business logic in the app.

## Why "lazy materialization" instead of a background job

**Decision:** Recurring transactions aren't pre-generated on a schedule (a cron job, a queue worker). Instead, every request to `/api/transactions`, `/api/dashboard`, or `/api/recurring-transactions` runs a `generateDue()` pass first, as middleware, which materializes any occurrence whose `next_run_date` has arrived.

**Why:** A one-hour-scoped demo app with SQLite has no natural place to run a background worker — no persistent process beyond the request/response cycle, no job queue infrastructure, and adding one would be pure overhead for what this needs to do. Lazy materialization gets the same end-user-visible result (recurring transactions "just show up" once their date arrives) with zero extra infrastructure: the *next* time anyone loads a page that touches transaction data, any due occurrences appear.

**Tradeoff accepted:** if literally nobody visits the app between a recurrence's due date and some later date, the transaction doesn't exist until someone does visit. For a demo/small-business tool where "nobody opens the app for weeks" is an edge case, not a requirement, this is an acceptable tradeoff versus standing up a scheduler.

## Why `generateDue` is scoped middleware, not global

It's attached only to the three routers whose data it actually affects — not registered globally on every request (which would run it on, say, every category GET for no reason). This keeps the cost proportional to the data actually being read.

## The hardest design problem: `apply_to_existing` (rebuild-with-new-config)

Changing a recurring template's interval (e.g. weekly → monthly) *after* transactions have already been generated under the old cadence creates a real problem: the already-generated rows are spaced weekly, but the new config says monthly. Patching each row's date in place can't produce correctly-spaced history — there's no way to turn 4 weekly rows into 1 monthly row by editing fields.

**Decision:** `rebuildFromScratch` deletes every previously-generated transaction for the template, rewinds the generation cursor (`next_run_date`) back to the *earliest* deleted transaction's date, and re-runs the generation loop from scratch under the new (already-updated) config. This is the only approach that produces genuinely correct history — the tradeoff is that it's destructive (the original transaction rows, and any manual edits to them, are gone), which is exactly why it's opt-in (`apply_to_existing: true`) rather than the default, and the UI surfaces it behind an explicit "destructive action" warning checkbox rather than making it the update flow's default behavior.

**Default (non-destructive) path:** an interval change without `apply_to_existing` only affects *future* generation — history stays exactly as it was generated under the old cadence. This forward-only default matches the principle of least surprise: editing a template shouldn't silently rewrite the past unless explicitly asked to.

## Idempotency

`generateDue()` must be safe to call on every request without duplicating rows. This works because the loop always advances `next_run_date` past every date it materializes and persists that cursor — calling it again immediately finds nothing due, by construction, not by an extra "have I already generated this" check. Tested explicitly (`is idempotent — calling twice does not duplicate`).
