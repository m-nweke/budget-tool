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

  it('excludes a category whose start_on is after the requested month', () => {
    categoryRepository.update(categoryId, { name: 'Software', budgeted_amount: 500, start_on: '2026-09-01' });

    const rows = dashboardRepository.findSummary('2026-08');
    expect(rows).toHaveLength(0);
  });

  it('includes a category whose start_on falls within the requested month', () => {
    categoryRepository.update(categoryId, { name: 'Software', budgeted_amount: 500, start_on: '2026-08-15' });

    const rows = dashboardRepository.findSummary('2026-08');
    expect(rows).toHaveLength(1);
  });

  it('backdated start_on surfaces transactions logged before the category existed in the system', () => {
    // The exact scenario this field exists for: create a category today to
    // track something that's been going on since January, backdate
    // start_on, and January's dashboard should show it with real spend.
    categoryRepository.update(categoryId, { name: 'Salaries', budgeted_amount: 10000, start_on: '2026-01-01' });
    transactionRepository.create({ amount: 5000, date: '2026-01-15', description: 'Payroll', category_id: categoryId });

    const [row] = dashboardRepository.findSummary('2026-01');
    expect(row.actual_spend).toBe(5000);
  });
});
