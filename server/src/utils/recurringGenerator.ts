import { db } from '../db';
import { advanceDate } from './dateMath';
import * as recurringRepo from '../repositories/recurringTransactionRepository';
import * as transactionRepo from '../repositories/transactionRepository';
import type { RecurringTransaction } from '../types';

export function todayString(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Materialize all due occurrences (next_run_date <= today) for every active template. */
export function generateDue(): void {
  const today = todayString();
  const run = db.transaction(() => {
    for (const template of recurringRepo.findAllActive()) {
      generateDueForTemplate(template, today);
    }
  });
  run();
}

function generateDueForTemplate(template: RecurringTransaction, upToDate: string): void {
  let cursor = template.next_run_date;

  while (cursor <= upToDate && (!template.end_date || cursor <= template.end_date)) {
    transactionRepo.createRecurringInstance(
      template.category_id,
      template.amount,
      template.description,
      cursor,
      template.id
    );
    cursor = advanceDate(cursor, template.interval);
  }

  recurringRepo.updateNextRunDate(template.id, cursor);
}

/**
 * Delete all previously-generated transactions for this template, rewind the
 * generation cursor to the earliest one's date, and regenerate from scratch
 * under the (already-updated) template config.
 */
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
