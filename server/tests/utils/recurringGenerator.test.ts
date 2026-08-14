import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../../src/db';
import { generateDue, rebuildFromScratch, todayString } from '../../src/utils/recurringGenerator';
import * as categoryRepo from '../../src/repositories/categoryRepository';
import * as recurringRepo from '../../src/repositories/recurringTransactionRepository';
import * as transactionRepo from '../../src/repositories/transactionRepository';

function resetDb() {
  db.exec('DELETE FROM transactions; DELETE FROM recurring_transactions; DELETE FROM categories;');
}

describe('generateDue', () => {
  beforeEach(() => {
    resetDb();
  });

  it('backfills all occurrences from a past start date to today', () => {
    const category = categoryRepo.create({ name: 'Office Supplies', budgeted_amount: 500 });
    const template = recurringRepo.create({
      amount: 10,
      category_id: category.id,
      interval: 'daily',
      start_date: '2020-01-01',
    });

    generateDue();

    const generated = transactionRepo.findByRecurringId(template.id);
    expect(generated.length).toBeGreaterThan(1000);
    expect(generated[0].date).toBe('2020-01-01');
  });

  it('respects each interval cadence', () => {
    const category = categoryRepo.create({ name: 'Rent', budgeted_amount: 2000 });
    const template = recurringRepo.create({
      amount: 100,
      category_id: category.id,
      interval: 'weekly',
      start_date: '2026-01-01',
    });

    // freeze "today" for a deterministic window
    vi.setSystemTime(new Date('2026-01-22T12:00:00Z'));
    generateDue();
    vi.useRealTimers();

    const generated = transactionRepo.findByRecurringId(template.id);
    expect(generated.map((t) => t.date)).toEqual(['2026-01-01', '2026-01-08', '2026-01-15', '2026-01-22']);
  });

  it('stops at end_date', () => {
    const category = categoryRepo.create({ name: 'Subscription', budgeted_amount: 100 });
    const template = recurringRepo.create({
      amount: 15,
      category_id: category.id,
      interval: 'monthly',
      start_date: '2026-01-01',
      end_date: '2026-03-01',
    });

    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'));
    generateDue();
    vi.useRealTimers();

    const generated = transactionRepo.findByRecurringId(template.id);
    expect(generated.map((t) => t.date)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
  });

  it('is idempotent — calling twice does not duplicate', () => {
    const category = categoryRepo.create({ name: 'Utilities', budgeted_amount: 300 });
    const template = recurringRepo.create({
      amount: 50,
      category_id: category.id,
      interval: 'monthly',
      start_date: '2026-01-01',
    });

    generateDue();
    const first = transactionRepo.findByRecurringId(template.id).length;
    generateDue();
    const second = transactionRepo.findByRecurringId(template.id).length;

    expect(second).toBe(first);
  });

  it('apply_to_existing deletes and regenerates under the new interval spacing', () => {
    const category = categoryRepo.create({ name: 'Cleaning', budgeted_amount: 200 });
    const template = recurringRepo.create({
      amount: 25,
      category_id: category.id,
      interval: 'weekly',
      start_date: '2026-01-01',
    });

    vi.setSystemTime(new Date('2026-02-01T00:00:00Z'));
    generateDue();

    recurringRepo.update(template.id, { interval: 'monthly' });
    rebuildFromScratch(template.id);
    vi.useRealTimers();

    const generated = transactionRepo.findByRecurringId(template.id);
    expect(generated.map((t) => t.date)).toEqual(['2026-01-01', '2026-02-01']);
  });

  it('todayString returns a YYYY-MM-DD string', () => {
    expect(todayString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
