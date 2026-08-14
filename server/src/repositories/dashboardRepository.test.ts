import { describe, it, expect, beforeEach } from 'vitest';
import db from '../db';
import categoryRepository from './categoryRepository';
import transactionRepository from './transactionRepository';
import dashboardRepository from './dashboardRepository';

let categoryId: number;

beforeEach(() => {
  db.exec('DELETE FROM transactions; DELETE FROM recurring_transactions; DELETE FROM categories;');
  categoryId = categoryRepository.create({ name: 'Software', budgeted_amount: 500 }).id;
});

describe('findSummary month scoping', () => {
  it('only counts transactions within the requested month', () => {
    transactionRepository.create({ amount: 50, date: '2026-07-31', description: 'July', category_id: categoryId });
    transactionRepository.create({ amount: 100, date: '2026-08-01', description: 'August', category_id: categoryId });
    transactionRepository.create({ amount: 200, date: '2026-08-31', description: 'August', category_id: categoryId });
    transactionRepository.create({ amount: 400, date: '2026-09-01', description: 'September', category_id: categoryId });

    const [row] = dashboardRepository.findSummary('2026-08');
    expect(row.actual_spend).toBe(300);
  });

  it('still shows a category with zero spend in the requested month', () => {
    transactionRepository.create({ amount: 999, date: '2026-01-01', description: 'January', category_id: categoryId });

    const [row] = dashboardRepository.findSummary('2026-08');
    expect(row.actual_spend).toBe(0);
    expect(row.difference).toBe(500);
  });

  it('excludes a category created after the requested month', () => {
    db.prepare('UPDATE categories SET created_at = ? WHERE id = ?').run('2026-09-01 00:00:00', categoryId);

    const rows = dashboardRepository.findSummary('2026-08');
    expect(rows).toHaveLength(0);
  });

  it('includes a category created within the requested month', () => {
    db.prepare('UPDATE categories SET created_at = ? WHERE id = ?').run('2026-08-15 00:00:00', categoryId);

    const rows = dashboardRepository.findSummary('2026-08');
    expect(rows).toHaveLength(1);
  });
});
