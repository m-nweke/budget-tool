import { describe, it, expect, beforeEach } from 'vitest';
import db from '../db';
import categoryRepository from './categoryRepository';

let deptA: number;
let deptB: number;

beforeEach(() => {
  db.exec(
    'DELETE FROM transactions; DELETE FROM recurring_transactions; DELETE FROM categories; DELETE FROM departments;'
  );
  deptA = db.prepare('INSERT INTO departments (name) VALUES (?)').run('Engineering').lastInsertRowid as number;
  deptB = db.prepare('INSERT INTO departments (name) VALUES (?)').run('Marketing').lastInsertRowid as number;
});

describe('categoryRepository', () => {
  it('creates and finds a category', () => {
    const created = categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA });
    expect(created).toMatchObject({ name: 'Software', budgeted_amount: 500, department_id: deptA });
    expect(categoryRepository.findById(created.id)).toEqual(created);
  });

  it('creates a category with no department (unscoped)', () => {
    const created = categoryRepository.create({ name: 'Shared', budgeted_amount: 500, department_id: null });
    expect(created.department_id).toBeNull();
  });

  it('creates a category with an approval threshold', () => {
    const created = categoryRepository.create({
      name: 'Software',
      budgeted_amount: 500,
      department_id: deptA,
      approval_threshold: 100,
    });
    expect(created.approval_threshold).toBe(100);
  });

  it('approval_threshold defaults to null when omitted', () => {
    const created = categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA });
    expect(created.approval_threshold).toBeNull();
  });

  it('findAll with no departmentIds returns every category, unscoped', () => {
    categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA });
    categoryRepository.create({ name: 'Travel', budgeted_amount: 1000, department_id: deptB });
    expect(categoryRepository.findAll()).toHaveLength(2);
  });

  it('findAll(departmentIds) scopes to the given departments', () => {
    categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA });
    categoryRepository.create({ name: 'Travel', budgeted_amount: 1000, department_id: deptB });

    const rows = categoryRepository.findAll([deptA]);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Software');
  });

  it('findAll([]) returns no rows — zero accessible departments means zero access', () => {
    categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA });
    expect(categoryRepository.findAll([])).toHaveLength(0);
  });

  it('update changes name and budgeted_amount', () => {
    const created = categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA });
    const updated = categoryRepository.update(created.id, {
      name: 'Tools',
      budgeted_amount: 750,
      department_id: deptA,
    });
    expect(updated).toMatchObject({ id: created.id, name: 'Tools', budgeted_amount: 750 });
  });

  it('update can move a category to a different department', () => {
    const created = categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA });
    const updated = categoryRepository.update(created.id, {
      name: 'Software',
      budgeted_amount: 500,
      department_id: deptB,
    });
    expect(updated.department_id).toBe(deptB);
  });

  it('start_on defaults to today when omitted', () => {
    const created = categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA });
    expect(created.start_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('start_on can be explicitly backdated on create', () => {
    const created = categoryRepository.create({
      name: 'Salaries',
      budgeted_amount: 10000,
      department_id: deptA,
      start_on: '2026-01-01',
    });
    expect(created.start_on).toBe('2026-01-01');
  });

  it('start_on can be changed on update', () => {
    const created = categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA });
    const updated = categoryRepository.update(created.id, {
      name: 'Software',
      budgeted_amount: 500,
      department_id: deptA,
      start_on: '2026-01-01',
    });
    expect(updated.start_on).toBe('2026-01-01');
  });

  it('remove deletes the category', () => {
    const created = categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA });
    categoryRepository.remove(created.id);
    expect(categoryRepository.findById(created.id)).toBeUndefined();
  });

  it('countTransactionsFor reflects linked transactions', () => {
    const created = categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA });
    expect(categoryRepository.countTransactionsFor(created.id)).toBe(0);
    db.prepare(
      'INSERT INTO transactions (amount, date, description, category_id) VALUES (10, ?, ?, ?)'
    ).run('2026-01-01', 'test', created.id);
    expect(categoryRepository.countTransactionsFor(created.id)).toBe(1);
  });
});
