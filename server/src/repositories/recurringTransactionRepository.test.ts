import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import db from '../db';
import categoryRepository from './categoryRepository';
import transactionRepository from './transactionRepository';
import recurringTransactionRepository from './recurringTransactionRepository';

let categoryId: number;

beforeEach(() => {
  db.exec('DELETE FROM transactions; DELETE FROM recurring_transactions; DELETE FROM categories;');
  categoryId = categoryRepository.create({ name: 'Software', budgeted_amount: 500 }).id;
  // Fix "today" so generateDue()'s <= today comparisons are deterministic.
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-13T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('generateDue', () => {
  it('backfills every missed monthly occurrence from a past start date', () => {
    recurringTransactionRepository.create({
      amount: 49.99,
      description: 'SaaS',
      category_id: categoryId,
      start_date: '2026-04-01',
      interval: 'monthly',
    });

    recurringTransactionRepository.generateDue();

    const dates = transactionRepository.findAll().map((t) => t.date);
    expect(dates).toEqual(['2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01']);

    const template = recurringTransactionRepository.findAllActive()[0];
    expect(template.next_run_date).toBe('2026-09-01');
  });

  it('generates weekly occurrences on their own cadence', () => {
    recurringTransactionRepository.create({
      amount: 25,
      description: 'Parking',
      category_id: categoryId,
      start_date: '2026-08-01',
      interval: 'weekly',
    });

    recurringTransactionRepository.generateDue();

    const dates = transactionRepository.findAll().map((t) => t.date);
    // Aug 1, 8 <= Aug 13; Aug 15 is not yet due.
    expect(dates).toEqual(['2026-08-01', '2026-08-08']);
  });

  it('does not generate anything for a future start date', () => {
    recurringTransactionRepository.create({
      amount: 25,
      description: 'Future',
      category_id: categoryId,
      start_date: '2026-09-01',
      interval: 'monthly',
    });

    recurringTransactionRepository.generateDue();

    expect(transactionRepository.findAll()).toHaveLength(0);
  });

  it('stops generating and deactivates once past end_date', () => {
    const created = recurringTransactionRepository.create({
      amount: 25,
      description: 'Trial',
      category_id: categoryId,
      start_date: '2026-08-01',
      interval: 'weekly',
      end_date: '2026-08-01',
    });

    recurringTransactionRepository.generateDue();

    // Only the Aug 1 occurrence should exist — the series ends there.
    expect(transactionRepository.findAll()).toHaveLength(1);
    expect(recurringTransactionRepository.findById(created.id)?.active).toBe(0);
    expect(recurringTransactionRepository.findAllActive()).toHaveLength(0);
  });

  it('is idempotent — calling it twice does not duplicate transactions', () => {
    recurringTransactionRepository.create({
      amount: 25,
      description: 'Parking',
      category_id: categoryId,
      start_date: '2026-08-01',
      interval: 'weekly',
    });

    recurringTransactionRepository.generateDue();
    recurringTransactionRepository.generateDue();

    expect(transactionRepository.findAll()).toHaveLength(2);
  });
});

describe('update', () => {
  it('auto-deactivates when the new end_date precedes the current next_run_date', () => {
    const created = recurringTransactionRepository.create({
      amount: 25,
      description: 'Parking',
      category_id: categoryId,
      start_date: '2026-09-01',
      interval: 'weekly',
    });

    const updated = recurringTransactionRepository.update(created.id, {
      amount: 25,
      description: 'Parking',
      category_id: categoryId,
      interval: 'weekly',
      end_date: '2026-08-01',
    });

    expect(updated.active).toBe(0);
  });

  it('changing interval does not touch already-generated transactions or the already-scheduled next occurrence', () => {
    const created = recurringTransactionRepository.create({
      amount: 25,
      description: 'Parking',
      category_id: categoryId,
      start_date: '2026-08-01',
      interval: 'weekly',
    });
    recurringTransactionRepository.generateDue();
    // Aug 1, Aug 8 generated; next_run_date advanced to Aug 15.
    const beforeSwitch = recurringTransactionRepository.findById(created.id)!;
    expect(beforeSwitch.next_run_date).toBe('2026-08-15');

    recurringTransactionRepository.update(created.id, {
      amount: 25,
      description: 'Parking',
      category_id: categoryId,
      interval: 'monthly',
    });

    const afterSwitch = recurringTransactionRepository.findById(created.id)!;
    // Interval changed, but next_run_date is untouched by the switch itself.
    expect(afterSwitch.interval).toBe('monthly');
    expect(afterSwitch.next_run_date).toBe('2026-08-15');

    // History unchanged: still exactly the two weekly-cadence occurrences.
    expect(transactionRepository.findAll().map((t) => t.date)).toEqual(['2026-08-01', '2026-08-08']);

    // The already-scheduled Aug 15 occurrence still fires as-is (the
    // switch doesn't retroactively move it), then cadence is monthly
    // from there: next becomes Sep 15, not Aug 22.
    vi.setSystemTime(new Date('2026-08-20T00:00:00Z'));
    recurringTransactionRepository.generateDue();
    expect(transactionRepository.findAll().map((t) => t.date)).toEqual([
      '2026-08-01',
      '2026-08-08',
      '2026-08-15',
    ]);
    expect(recurringTransactionRepository.findById(created.id)!.next_run_date).toBe('2026-09-15');
  });

  it('apply_to_existing deletes old occurrences and regenerates from the original start date under the new config', () => {
    const otherCategoryId = categoryRepository.create({ name: 'Travel', budgeted_amount: 200 }).id;
    const created = recurringTransactionRepository.create({
      amount: 25,
      description: 'Parking',
      category_id: categoryId,
      start_date: '2026-08-01',
      interval: 'weekly',
    });
    recurringTransactionRepository.generateDue();
    // Weekly history: Aug 1, Aug 8.
    expect(transactionRepository.findAll().map((t) => t.date)).toEqual(['2026-08-01', '2026-08-08']);

    recurringTransactionRepository.update(created.id, {
      amount: 30,
      description: 'Garage parking',
      category_id: otherCategoryId,
      interval: 'monthly',
      apply_to_existing: true,
    });

    // Regenerated from the original start (Aug 1) under monthly cadence:
    // only Aug 1 is due by "today" (Aug 13) — Sep 1 isn't yet. The old
    // Aug 8 weekly row is gone, not just re-labeled.
    const rows = transactionRepository.findAll();
    expect(rows.map((t) => t.date)).toEqual(['2026-08-01']);
    expect(rows[0]).toMatchObject({ amount: 30, description: 'Garage parking', category_id: otherCategoryId });

    const template = recurringTransactionRepository.findById(created.id)!;
    expect(template.interval).toBe('monthly');
    expect(template.next_run_date).toBe('2026-09-01');
  });

  it('without apply_to_existing, already-generated transactions are left as-is even when interval changes', () => {
    const created = recurringTransactionRepository.create({
      amount: 25,
      description: 'Parking',
      category_id: categoryId,
      start_date: '2026-08-01',
      interval: 'weekly',
    });
    recurringTransactionRepository.generateDue();

    recurringTransactionRepository.update(created.id, {
      amount: 30,
      description: 'Garage parking',
      category_id: categoryId,
      interval: 'monthly',
    });

    const rows = transactionRepository.findAll();
    expect(rows.map((t) => t.date)).toEqual(['2026-08-01', '2026-08-08']);
    for (const row of rows) {
      expect(row.amount).toBe(25);
      expect(row.description).toBe('Parking');
    }
  });

  it('apply_to_existing on a series with no generated occurrences yet is a no-op regeneration', () => {
    const created = recurringTransactionRepository.create({
      amount: 25,
      description: 'Parking',
      category_id: categoryId,
      start_date: '2026-09-01', // future — nothing generated yet
      interval: 'weekly',
    });

    const updated = recurringTransactionRepository.update(created.id, {
      amount: 30,
      description: 'Garage parking',
      category_id: categoryId,
      interval: 'monthly',
      apply_to_existing: true,
    });

    expect(transactionRepository.findAll()).toHaveLength(0);
    expect(updated.next_run_date).toBe('2026-09-01'); // untouched, nothing to rewind to
  });
});
