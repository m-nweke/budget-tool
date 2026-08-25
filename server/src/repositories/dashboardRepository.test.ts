import { describe, it, expect, beforeEach } from 'vitest';
import db from '../db';
import categoryRepository from './categoryRepository';
import transactionRepository from './transactionRepository';
import dashboardRepository from './dashboardRepository';

let tenantId: number;
let categoryId: number;
let deptA: number;
let deptB: number;

beforeEach(() => {
  db.exec(
    'DELETE FROM transactions; DELETE FROM recurring_transactions; DELETE FROM categories; DELETE FROM departments; DELETE FROM tenants;'
  );
  tenantId = db.prepare("INSERT INTO tenants (name, type) VALUES ('Acme Co', 'enterprise')").run()
    .lastInsertRowid as number;
  deptA = db.prepare('INSERT INTO departments (name, tenant_id) VALUES (?, ?)').run('Engineering', tenantId)
    .lastInsertRowid as number;
  deptB = db.prepare('INSERT INTO departments (name, tenant_id) VALUES (?, ?)').run('Marketing', tenantId)
    .lastInsertRowid as number;
  categoryId = categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA }, tenantId).id;
});

// Every transaction below is created pre-approved (approved: true) — a
// dedicated test covers the approved-only aggregation behavior itself.
describe('findSummary month scoping', () => {
  it('only counts transactions within the requested month', () => {
    transactionRepository.create({ amount: 50, date: '2026-07-31', description: 'July', category_id: categoryId }, null, false, true);
    transactionRepository.create({ amount: 100, date: '2026-08-01', description: 'August', category_id: categoryId }, null, false, true);
    transactionRepository.create({ amount: 200, date: '2026-08-31', description: 'August', category_id: categoryId }, null, false, true);
    transactionRepository.create({ amount: 400, date: '2026-09-01', description: 'September', category_id: categoryId }, null, false, true);

    const [row] = dashboardRepository.findSummary('2026-08');
    expect(row.actual_spend).toBe(300);
  });

  it('still shows a category with zero spend in the requested month', () => {
    transactionRepository.create({ amount: 999, date: '2026-01-01', description: 'January', category_id: categoryId }, null, false, true);

    const [row] = dashboardRepository.findSummary('2026-08');
    expect(row.actual_spend).toBe(0);
    expect(row.difference).toBe(500);
  });

  it('excludes a category whose start_on is after the requested month', () => {
    categoryRepository.update(categoryId, { name: 'Software', budgeted_amount: 500, department_id: deptA, start_on: '2026-09-01' });

    const rows = dashboardRepository.findSummary('2026-08');
    expect(rows).toHaveLength(0);
  });

  it('includes a category whose start_on falls within the requested month', () => {
    categoryRepository.update(categoryId, { name: 'Software', budgeted_amount: 500, department_id: deptA, start_on: '2026-08-15' });

    const rows = dashboardRepository.findSummary('2026-08');
    expect(rows).toHaveLength(1);
  });

  it('backdated start_on surfaces transactions logged before the category existed in the system', () => {
    // The exact scenario this field exists for: create a category today to
    // track something that's been going on since January, backdate
    // start_on, and January's dashboard should show it with real spend.
    categoryRepository.update(categoryId, { name: 'Salaries', budgeted_amount: 10000, department_id: deptA, start_on: '2026-01-01' });
    transactionRepository.create({ amount: 5000, date: '2026-01-15', description: 'Payroll', category_id: categoryId }, null, false, true);

    const [row] = dashboardRepository.findSummary('2026-01');
    expect(row.actual_spend).toBe(5000);
  });
});

describe('findSummary with a month range', () => {
  it('sums spend across every month in the range', () => {
    transactionRepository.create({ amount: 100, date: '2026-06-15', description: 'June', category_id: categoryId }, null, false, true);
    transactionRepository.create({ amount: 200, date: '2026-07-15', description: 'July', category_id: categoryId }, null, false, true);
    transactionRepository.create({ amount: 300, date: '2026-08-15', description: 'August', category_id: categoryId }, null, false, true);
    transactionRepository.create({ amount: 999, date: '2026-09-01', description: 'September', category_id: categoryId }, null, false, true);

    const [row] = dashboardRepository.findSummary('2026-06', '2026-08');
    expect(row.actual_spend).toBe(600);
  });

  it('scales budgeted_amount by the number of months in the range', () => {
    const [row] = dashboardRepository.findSummary('2026-06', '2026-08');
    expect(row.budgeted_amount).toBe(1500); // 500/month * 3 months
  });

  it('a single-month range (from === to) behaves like the plain month case', () => {
    const [row] = dashboardRepository.findSummary('2026-08', '2026-08');
    expect(row.budgeted_amount).toBe(500);
  });

  it('excludes a category whose start_on is after the entire range', () => {
    categoryRepository.update(categoryId, { name: 'Software', budgeted_amount: 500, department_id: deptA, start_on: '2026-09-01' });
    const rows = dashboardRepository.findSummary('2026-06', '2026-08');
    expect(rows).toHaveLength(0);
  });
});

describe('findSummary approval gating', () => {
  it('excludes a pending (unapproved) transaction from actual_spend', () => {
    transactionRepository.create({ amount: 999, date: '2026-08-01', description: 'Pending', category_id: categoryId }, null, true, false);

    const [row] = dashboardRepository.findSummary('2026-08');
    expect(row.actual_spend).toBe(0);
  });

  it('counts a transaction once it is approved', () => {
    const created = transactionRepository.create(
      { amount: 999, date: '2026-08-01', description: 'Was pending', category_id: categoryId },
      null,
      true,
      false
    );
    transactionRepository.approve(created.id, true);

    const [row] = dashboardRepository.findSummary('2026-08');
    expect(row.actual_spend).toBe(999);
  });
});

describe('findSummary department scoping', () => {
  it('scopes to the given departments', () => {
    const otherCategoryId = categoryRepository.create({ name: 'Travel', budgeted_amount: 200, department_id: deptB }, tenantId).id;
    transactionRepository.create({ amount: 100, date: '2026-08-01', description: 'A', category_id: categoryId }, null, false, true);
    transactionRepository.create({ amount: 50, date: '2026-08-01', description: 'B', category_id: otherCategoryId }, null, false, true);

    const rows = dashboardRepository.findSummary('2026-08', '2026-08', [deptA]);
    expect(rows).toHaveLength(1);
    expect(rows[0].category_id).toBe(categoryId);
  });

  it('returns no rows for an empty departmentIds array', () => {
    const rows = dashboardRepository.findSummary('2026-08', '2026-08', []);
    expect(rows).toHaveLength(0);
  });

  it('includes the department id and name on each row', () => {
    const [row] = dashboardRepository.findSummary('2026-08');
    expect(row.department_id).toBe(deptA);
    expect(row.department_name).toBe('Engineering');
  });

  it('does not leak another tenant\'s department name for a cross-tenant department_id', () => {
    // Simulates data corruption (bad migration, manual DB edit) rather than
    // anything reachable through the app's own write paths, which always
    // keep department_id and category.tenant_id in the same tenant.
    const otherTenantId = db.prepare("INSERT INTO tenants (name, type) VALUES ('Other Co', 'enterprise')").run()
      .lastInsertRowid as number;
    const otherDeptId = db.prepare('INSERT INTO departments (name, tenant_id) VALUES (?, ?)').run('Secret Dept', otherTenantId)
      .lastInsertRowid as number;
    db.prepare('UPDATE categories SET department_id = ? WHERE id = ?').run(otherDeptId, categoryId);

    const [row] = dashboardRepository.findSummary('2026-08');
    expect(row.department_name).toBeNull();
  });

  it('returns null department id/name for a personal-tenant category', () => {
    const personalTenantId = db
      .prepare("INSERT INTO tenants (name, type) VALUES ('Personal', 'personal')")
      .run().lastInsertRowid as number;
    const personalCategoryId = categoryRepository.create(
      { name: 'Groceries', budgeted_amount: 100, department_id: null },
      personalTenantId
    ).id;

    const rows = dashboardRepository.findSummary('2026-08', '2026-08', undefined, personalTenantId);
    const row = rows.find((r) => r.category_id === personalCategoryId)!;
    expect(row.department_id).toBeNull();
    expect(row.department_name).toBeNull();
  });
});
