# Story 3: Recurring Transaction Generation Engine — How It Works

## Concept: the generation loop

```ts
function generateDueForTemplate(template: RecurringTransaction, upToDate: string): void {
  let cursor = template.next_run_date;

  while (cursor <= upToDate && (!template.end_date || cursor <= template.end_date)) {
    transactionRepo.createRecurringInstance(
      template.category_id, template.amount, template.description, cursor, template.id
    );
    cursor = advanceDate(cursor, template.interval);
  }

  recurringRepo.updateNextRunDate(template.id, cursor);
}
```

`cursor` starts at the template's stored `next_run_date` (its generation bookmark) and walks forward one interval at a time, creating a transaction at each due date, until it either passes `upToDate` (today) or the template's `end_date`. The loop's exit condition — `cursor` ends up either just past today or just past `end_date` — becomes the new `next_run_date`, persisted once at the end. That single persisted value is what makes the whole thing idempotent: the next call starts exactly where this one left off.

## Concept: `generateDue()` wraps every template in one transaction

```ts
export function generateDue(): void {
  const today = todayString();
  const run = db.transaction(() => {
    for (const template of recurringRepo.findAllActive()) {
      generateDueForTemplate(template, today);
    }
  });
  run();
}
```

`better-sqlite3`'s `db.transaction(fn)` wraps the whole multi-template, multi-row backfill in a single atomic commit. If a template with a 10-year-old `start_date` needs to backfill hundreds of daily occurrences, all of them commit together — a crash partway through can't leave the database with half a backfill applied.

## Concept: `rebuildFromScratch` — delete, rewind, regenerate

```ts
export function rebuildFromScratch(templateId: number): void {
  const run = db.transaction(() => {
    const existing = transactionRepo.findByRecurringId(templateId);
    const earliestDate = existing.length > 0 ? existing[0].date : undefined;

    transactionRepo.deleteByRecurringId(templateId);

    const template = recurringRepo.findById(templateId);
    if (!template) return;

    const rewoundStart = earliestDate ?? template.next_run_date;
    recurringRepo.updateNextRunDate(templateId, rewoundStart);

    const refreshed = recurringRepo.findById(templateId)!;
    generateDueForTemplate(refreshed, todayString());
  });
  run();
}
```

Walking through it: `findByRecurringId` returns existing generated transactions ordered by date ascending, so `existing[0].date` is the earliest one — that becomes the new starting point. Deleting first, then rewinding the cursor to that earliest date, then calling the *same* `generateDueForTemplate` loop used by normal generation means there's only one code path that actually creates transaction rows — rebuild isn't a separate, parallel implementation that could drift from normal generation's behavior.

## Concept: why this needed a debugging session to get right

The route calling this (story 4) calls `recurringRepo.update()` — which changes `interval` — *before* calling `rebuildFromScratch()`. That ordering matters: `rebuildFromScratch` re-fetches the template fresh (`recurringRepo.findById(templateId)`) after rewinding the cursor, specifically so it picks up the *new* interval, not whatever interval was in memory before the update. An earlier draft passed a stale in-memory template object into the regeneration call and silently regenerated under the *old* cadence — caught by the `apply_to_existing deletes and regenerates under the new interval spacing` test, which asserts the actual output dates, not just that *some* rows exist.
