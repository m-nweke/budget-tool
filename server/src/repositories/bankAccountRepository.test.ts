import { describe, it, expect, beforeEach } from 'vitest';
import db from '../db';
import bankAccountRepository from './bankAccountRepository';

let tenantId: number;

beforeEach(() => {
  db.exec('DELETE FROM paycheck_splits; DELETE FROM savings_goals; DELETE FROM bank_accounts; DELETE FROM tenants;');
  tenantId = db.prepare("INSERT INTO tenants (name, type) VALUES ('Pat''s Budget', 'personal')").run()
    .lastInsertRowid as number;
});

describe('bankAccountRepository', () => {
  it('creates and finds a bank account', () => {
    const created = bankAccountRepository.create({ name: 'Checking', type: 'checking' }, tenantId);
    expect(created).toMatchObject({ name: 'Checking', type: 'checking', current_balance: 0 });
    expect(bankAccountRepository.findById(created.id)).toEqual(created);
  });

  it('current_balance can be set on create', () => {
    const created = bankAccountRepository.create({ name: 'Savings', type: 'savings', current_balance: 500 }, tenantId);
    expect(created.current_balance).toBe(500);
  });

  it('findAll scopes to the given tenant', () => {
    const otherTenantId = db.prepare("INSERT INTO tenants (name, type) VALUES ('Other', 'personal')").run()
      .lastInsertRowid as number;
    bankAccountRepository.create({ name: 'Checking', type: 'checking' }, tenantId);
    bankAccountRepository.create({ name: 'Other Checking', type: 'checking' }, otherTenantId);

    const rows = bankAccountRepository.findAll(tenantId);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Checking');
  });

  it('update changes name, type, and current_balance', () => {
    const created = bankAccountRepository.create({ name: 'Checking', type: 'checking' }, tenantId);
    const updated = bankAccountRepository.update(created.id, { name: 'Main Checking', type: 'checking', current_balance: 1200 });
    expect(updated).toMatchObject({ id: created.id, name: 'Main Checking', current_balance: 1200 });
  });

  it('remove deletes the account', () => {
    const created = bankAccountRepository.create({ name: 'Checking', type: 'checking' }, tenantId);
    bankAccountRepository.remove(created.id);
    expect(bankAccountRepository.findById(created.id)).toBeUndefined();
  });

  it('countPaycheckSplitsFor / countSavingsGoalsFor reflect dependents', () => {
    const account = bankAccountRepository.create({ name: 'Checking', type: 'checking' }, tenantId);
    expect(bankAccountRepository.countPaycheckSplitsFor(account.id)).toBe(0);
    expect(bankAccountRepository.countSavingsGoalsFor(account.id)).toBe(0);

    const paycheckId = db
      .prepare('INSERT INTO paychecks (tenant_id, label, amount, frequency, next_pay_date) VALUES (?, ?, ?, ?, ?)')
      .run(tenantId, 'Job', 2000, 'biweekly', '2026-09-01').lastInsertRowid as number;
    db.prepare(
      'INSERT INTO paycheck_splits (paycheck_id, bank_account_id, split_type, value) VALUES (?, ?, ?, ?)'
    ).run(paycheckId, account.id, 'fixed', 500);
    expect(bankAccountRepository.countPaycheckSplitsFor(account.id)).toBe(1);

    db.prepare(
      'INSERT INTO savings_goals (tenant_id, name, target_amount, bank_account_id) VALUES (?, ?, ?, ?)'
    ).run(tenantId, 'Emergency Fund', 5000, account.id);
    expect(bankAccountRepository.countSavingsGoalsFor(account.id)).toBe(1);
  });
});
