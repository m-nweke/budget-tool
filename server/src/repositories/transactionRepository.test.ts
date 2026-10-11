import { describe, it, expect, beforeEach } from 'vitest';
import db from '../db';
import categoryRepository from './categoryRepository';
import transactionRepository from './transactionRepository';

let tenantId: number;
let categoryId: number;
let otherCategoryId: number;
let deptA: number;
let deptB: number;
let userId: number;

beforeEach(async () => {
  (await db.exec(
    'DELETE FROM transactions; DELETE FROM recurring_transactions; DELETE FROM categories; DELETE FROM departments; DELETE FROM tenants; DELETE FROM users;'
  ));
  tenantId = (await db.run("INSERT INTO tenants (name, type) VALUES ('Acme Co', 'enterprise')"))
    .lastInsertRowid as number;
  deptA = (await db.run('INSERT INTO departments (name, tenant_id) VALUES (?, ?)', 'Engineering', tenantId))
    .lastInsertRowid as number;
  deptB = (await db.run('INSERT INTO departments (name, tenant_id) VALUES (?, ?)', 'Marketing', tenantId))
    .lastInsertRowid as number;
  categoryId = (await categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA }, tenantId)).id;
  otherCategoryId = (await categoryRepository.create({ name: 'Travel', budgeted_amount: 500, department_id: deptB }, tenantId)).id;
  userId = (await db.run('INSERT INTO users (name, email) VALUES (?, ?)', 'Test User', 'test@example.com'))
    .lastInsertRowid as number;
});

describe('transactionRepository', () => {
  it('creates a transaction with recurring_transaction_id null', async () => {
    const created = (await transactionRepository.create(
      { amount: 49.99, date: '2026-08-01', description: 'SaaS', category_id: categoryId },
      userId,
      false,
      true
    ));
    expect(created.recurring_transaction_id).toBeNull();
  });

  it('creates a transaction recording created_by, needs_approval, and approved', async () => {
    const created = (await transactionRepository.create(
      { amount: 49.99, date: '2026-08-01', description: 'SaaS', category_id: categoryId },
      userId,
      true,
      false
    ));
    expect(created).toMatchObject({ created_by: userId, needs_approval: true, approved: false });
  });

  it('a generated occurrence has created_by null', async () => {
    const recurringId = (await db.run("INSERT INTO recurring_transactions (amount, category_id, interval, next_run_date) VALUES (49.99, ?, 'monthly', '2026-08-01')", categoryId)).lastInsertRowid as number;

    const created = (await transactionRepository.createGenerated(
      { amount: 49.99, date: '2026-08-01', description: 'SaaS', category_id: categoryId },
      recurringId,
      false,
      true
    ));
    expect(created).toMatchObject({ recurring_transaction_id: recurringId, created_by: null });
  });

  it('update changes fields, preserves id, and recomputes needs_approval/approved', async () => {
    const created = (await transactionRepository.create(
      { amount: 10, date: '2026-08-01', description: 'A', category_id: categoryId },
      userId,
      false,
      true
    ));
    const updated = (await transactionRepository.update(
      created.id,
      { amount: 20, date: '2026-08-02', description: 'B', category_id: categoryId },
      true,
      false
    ));
    expect(updated).toMatchObject({
      id: created.id,
      amount: 20,
      date: '2026-08-02',
      description: 'B',
      needs_approval: true,
      approved: false,
    });
  });

  it('remove deletes the transaction', async () => {
    const created = (await transactionRepository.create(
      { amount: 10, date: '2026-08-01', description: 'A', category_id: categoryId },
      userId,
      false,
      true
    ));
    (await transactionRepository.remove(created.id));
    (await expect((await transactionRepository.findById(created.id))).toBeUndefined());
  });

  it('findAll with no departmentIds returns every transaction, unscoped', async () => {
    (await transactionRepository.create({ amount: 10, date: '2026-08-01', description: 'A', category_id: categoryId }, userId, false, true));
    (await transactionRepository.create({ amount: 20, date: '2026-08-01', description: 'B', category_id: otherCategoryId }, userId, false, true));
    (await expect((await transactionRepository.findAll())).toHaveLength(2));
  });

  it('findAll(departmentIds) scopes via the transaction\'s category department', async () => {
    (await transactionRepository.create({ amount: 10, date: '2026-08-01', description: 'A', category_id: categoryId }, userId, false, true));
    (await transactionRepository.create({ amount: 20, date: '2026-08-01', description: 'B', category_id: otherCategoryId }, userId, false, true));

    const rows = (await transactionRepository.findAll([deptA]));
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe('A');
  });

  it('findAll([]) returns no rows', async () => {
    (await transactionRepository.create({ amount: 10, date: '2026-08-01', description: 'A', category_id: categoryId }, userId, false, true));
    (await expect((await transactionRepository.findAll([]))).toHaveLength(0));
  });

  describe('approve', () => {
    it('approving clears needs_approval and sets approved', async () => {
      const created = (await transactionRepository.create(
        { amount: 500, date: '2026-08-01', description: 'Big purchase', category_id: categoryId },
        userId,
        true,
        false
      ));
      const approved = (await transactionRepository.approve(created.id, true));
      expect(approved).toMatchObject({ needs_approval: false, approved: true });
    });

    it('rejecting clears needs_approval, leaves approved false, and does not delete the row', async () => {
      const created = (await transactionRepository.create(
        { amount: 500, date: '2026-08-01', description: 'Big purchase', category_id: categoryId },
        userId,
        true,
        false
      ));
      const rejected = (await transactionRepository.approve(created.id, false));
      expect(rejected).toMatchObject({ needs_approval: false, approved: false });
      (await expect((await transactionRepository.findById(created.id))).toBeDefined());
    });
  });

  describe('findPendingApproval', () => {
    it('returns only transactions with needs_approval scoped to the given departments', async () => {
      (await transactionRepository.create(
        { amount: 500, date: '2026-08-01', description: 'Pending A', category_id: categoryId },
        userId,
        true,
        false
      ));
      (await transactionRepository.create(
        { amount: 10, date: '2026-08-01', description: 'Auto-approved', category_id: categoryId },
        userId,
        false,
        true
      ));
      (await transactionRepository.create(
        { amount: 500, date: '2026-08-01', description: 'Pending B (other dept)', category_id: otherCategoryId },
        userId,
        true,
        false
      ));

      const pending = (await transactionRepository.findPendingApproval([deptA]));
      expect(pending).toHaveLength(1);
      expect(pending[0].description).toBe('Pending A');
    });

    it('returns no rows for an empty departmentIds array', async () => {
      (await transactionRepository.create(
        { amount: 500, date: '2026-08-01', description: 'Pending', category_id: categoryId },
        userId,
        true,
        false
      ));
      (await expect((await transactionRepository.findPendingApproval([]))).toHaveLength(0));
    });
  });
});
