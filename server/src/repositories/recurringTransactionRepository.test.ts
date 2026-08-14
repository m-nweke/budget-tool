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
});
