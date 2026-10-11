import { describe, it, expect, beforeEach } from 'vitest';
import db from '../db';
import categoryRepository from './categoryRepository';

let tenantId: number;
let deptA: number;
let deptB: number;

beforeEach(async () => {
  (await db.exec(
    'DELETE FROM transactions; DELETE FROM recurring_transactions; DELETE FROM categories; DELETE FROM departments; DELETE FROM tenants;'
  ));
  tenantId = (await db.run("INSERT INTO tenants (name, type) VALUES ('Acme Co', 'enterprise')"))
    .lastInsertRowid as number;
  deptA = (await db.run('INSERT INTO departments (name, tenant_id) VALUES (?, ?)', 'Engineering', tenantId))
    .lastInsertRowid as number;
  deptB = (await db.run('INSERT INTO departments (name, tenant_id) VALUES (?, ?)', 'Marketing', tenantId))
    .lastInsertRowid as number;
});

describe('categoryRepository', () => {
  it('creates and finds a category', async () => {
    const created = (await categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA }, tenantId));
    expect(created).toMatchObject({ name: 'Software', budgeted_amount: 500, department_id: deptA });
    (await expect((await categoryRepository.findById(created.id))).toEqual(created));
  });

  it('creates a category with no department (unscoped)', async () => {
    const created = (await categoryRepository.create({ name: 'Shared', budgeted_amount: 500, department_id: null }, tenantId));
    expect(created.department_id).toBeNull();
  });

  it('creates a category with an approval threshold', async () => {
    const created = (await categoryRepository.create({
      name: 'Software',
      budgeted_amount: 500,
      department_id: deptA,
      approval_threshold: 100,
    }, tenantId));
    expect(created.approval_threshold).toBe(100);
  });

  it('approval_threshold defaults to null when omitted', async () => {
    const created = (await categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA }, tenantId));
    expect(created.approval_threshold).toBeNull();
  });

  it('findAll with no departmentIds returns every category, unscoped', async () => {
    (await categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA }, tenantId));
    (await categoryRepository.create({ name: 'Travel', budgeted_amount: 1000, department_id: deptB }, tenantId));
    (await expect((await categoryRepository.findAll())).toHaveLength(2));
  });

  it('findAll(departmentIds) scopes to the given departments', async () => {
    (await categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA }, tenantId));
    (await categoryRepository.create({ name: 'Travel', budgeted_amount: 1000, department_id: deptB }, tenantId));

    const rows = (await categoryRepository.findAll([deptA]));
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Software');
  });

  it('findAll([]) returns no rows — zero accessible departments means zero access', async () => {
    (await categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA }, tenantId));
    (await expect((await categoryRepository.findAll([]))).toHaveLength(0));
  });

  it('findAll(undefined, tenantId) scopes to the tenant when there are no departments (personal tenants)', async () => {
    const personalTenantId = (await db.run("INSERT INTO tenants (name, type) VALUES ('Personal Budget', 'personal')"))
      .lastInsertRowid as number;
    (await categoryRepository.create({ name: 'Groceries', budgeted_amount: 400, department_id: null }, personalTenantId));
    (await categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA }, tenantId));

    const rows = (await categoryRepository.findAll(undefined, personalTenantId));
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Groceries');
  });

  it('update changes name and budgeted_amount', async () => {
    const created = (await categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA }, tenantId));
    const updated = (await categoryRepository.update(created.id, {
      name: 'Tools',
      budgeted_amount: 750,
      department_id: deptA,
    }));
    expect(updated).toMatchObject({ id: created.id, name: 'Tools', budgeted_amount: 750 });
  });

  it('update can move a category to a different department', async () => {
    const created = (await categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA }, tenantId));
    const updated = (await categoryRepository.update(created.id, {
      name: 'Software',
      budgeted_amount: 500,
      department_id: deptB,
    }));
    expect(updated.department_id).toBe(deptB);
  });

  it('start_on defaults to today when omitted', async () => {
    const created = (await categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA }, tenantId));
    expect(created.start_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('start_on can be explicitly backdated on create', async () => {
    const created = (await categoryRepository.create({
      name: 'Salaries',
      budgeted_amount: 10000,
      department_id: deptA,
      start_on: '2026-01-01',
    }, tenantId));
    expect(created.start_on).toBe('2026-01-01');
  });

  it('start_on can be changed on update', async () => {
    const created = (await categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA }, tenantId));
    const updated = (await categoryRepository.update(created.id, {
      name: 'Software',
      budgeted_amount: 500,
      department_id: deptA,
      start_on: '2026-01-01',
    }));
    expect(updated.start_on).toBe('2026-01-01');
  });

  it('remove deletes the category', async () => {
    const created = (await categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA }, tenantId));
    (await categoryRepository.remove(created.id));
    (await expect((await categoryRepository.findById(created.id))).toBeUndefined());
  });

  it('countTransactionsFor reflects linked transactions', async () => {
    const created = (await categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA }, tenantId));
    (await expect((await categoryRepository.countTransactionsFor(created.id))).toBe(0));
    (await db.run('INSERT INTO transactions (amount, date, description, category_id) VALUES (10, ?, ?, ?)', '2026-01-01', 'test', created.id));
    (await expect((await categoryRepository.countTransactionsFor(created.id))).toBe(1));
  });
});
