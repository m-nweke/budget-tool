import { describe, it, expect, beforeEach } from 'vitest';
import db from '../db';
import categoryRepository from './categoryRepository';

beforeEach(() => {
  db.exec('DELETE FROM transactions; DELETE FROM recurring_transactions; DELETE FROM categories;');
});

describe('categoryRepository', () => {
  it('creates and finds a category', () => {
    const created = categoryRepository.create({ name: 'Software', budgeted_amount: 500 });
    expect(created).toMatchObject({ name: 'Software', budgeted_amount: 500 });
    expect(categoryRepository.findById(created.id)).toEqual(created);
  });

  it('findAll returns every category', () => {
    categoryRepository.create({ name: 'Software', budgeted_amount: 500 });
    categoryRepository.create({ name: 'Travel', budgeted_amount: 1000 });
    expect(categoryRepository.findAll()).toHaveLength(2);
  });

  it('update changes name and budgeted_amount', () => {
    const created = categoryRepository.create({ name: 'Software', budgeted_amount: 500 });
    const updated = categoryRepository.update(created.id, { name: 'Tools', budgeted_amount: 750 });
    expect(updated).toMatchObject({ id: created.id, name: 'Tools', budgeted_amount: 750 });
  });

  it('start_on defaults to today when omitted', () => {
    const created = categoryRepository.create({ name: 'Software', budgeted_amount: 500 });
    expect(created.start_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('start_on can be explicitly backdated on create', () => {
    const created = categoryRepository.create({ name: 'Salaries', budgeted_amount: 10000, start_on: '2026-01-01' });
    expect(created.start_on).toBe('2026-01-01');
  });

  it('start_on can be changed on update', () => {
    const created = categoryRepository.create({ name: 'Software', budgeted_amount: 500 });
    const updated = categoryRepository.update(created.id, {
      name: 'Software',
      budgeted_amount: 500,
      start_on: '2026-01-01',
    });
    expect(updated.start_on).toBe('2026-01-01');
  });

  it('remove deletes the category', () => {
    const created = categoryRepository.create({ name: 'Software', budgeted_amount: 500 });
    categoryRepository.remove(created.id);
    expect(categoryRepository.findById(created.id)).toBeUndefined();
  });

  it('countTransactionsFor reflects linked transactions', () => {
    const created = categoryRepository.create({ name: 'Software', budgeted_amount: 500 });
    expect(categoryRepository.countTransactionsFor(created.id)).toBe(0);
    db.prepare(
      'INSERT INTO transactions (amount, date, description, category_id) VALUES (10, ?, ?, ?)'
    ).run('2026-01-01', 'test', created.id);
    expect(categoryRepository.countTransactionsFor(created.id)).toBe(1);
  });
});
