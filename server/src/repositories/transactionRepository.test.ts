import { describe, it, expect, beforeEach } from 'vitest';
import db from '../db';
import categoryRepository from './categoryRepository';
import transactionRepository from './transactionRepository';

let categoryId: number;

beforeEach(() => {
  db.exec('DELETE FROM transactions; DELETE FROM recurring_transactions; DELETE FROM categories;');
  categoryId = categoryRepository.create({ name: 'Software', budgeted_amount: 500 }).id;
});

describe('transactionRepository', () => {
  it('creates a transaction with recurring_transaction_id null', () => {
    const created = transactionRepository.create({
      amount: 49.99,
      date: '2026-08-01',
      description: 'SaaS',
      category_id: categoryId,
    });
    expect(created.recurring_transaction_id).toBeNull();
  });

  it('createGenerated links back to the recurring template', () => {
    const recurringId = db
      .prepare(
        "INSERT INTO recurring_transactions (amount, category_id, interval, next_run_date) VALUES (49.99, ?, 'monthly', '2026-08-01')"
      )
      .run(categoryId).lastInsertRowid as number;

    const created = transactionRepository.createGenerated(
      { amount: 49.99, date: '2026-08-01', description: 'SaaS', category_id: categoryId },
      recurringId
    );
    expect(created.recurring_transaction_id).toBe(recurringId);
  });

  it('update changes fields and preserves id', () => {
    const created = transactionRepository.create({
      amount: 10,
      date: '2026-08-01',
      description: 'A',
      category_id: categoryId,
    });
    const updated = transactionRepository.update(created.id, {
      amount: 20,
      date: '2026-08-02',
      description: 'B',
      category_id: categoryId,
    });
    expect(updated).toMatchObject({ id: created.id, amount: 20, date: '2026-08-02', description: 'B' });
  });

  it('remove deletes the transaction', () => {
    const created = transactionRepository.create({
      amount: 10,
      date: '2026-08-01',
      description: 'A',
      category_id: categoryId,
    });
    transactionRepository.remove(created.id);
    expect(transactionRepository.findById(created.id)).toBeUndefined();
  });
});
