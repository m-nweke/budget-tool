import { describe, it, expect, beforeEach } from 'vitest';
import db from '../db';
import bankAccountRepository from './bankAccountRepository';

let tenantId: number;

beforeEach(async () => {
  (await db.exec('DELETE FROM paycheck_splits; DELETE FROM savings_goals; DELETE FROM bank_accounts; DELETE FROM tenants;'));
  tenantId = (await db.run("INSERT INTO tenants (name, type) VALUES ('Pat''s Budget', 'personal')"))
    .lastInsertRowid as number;
});

describe('bankAccountRepository', () => {
  it('creates and finds a bank account', async () => {
    const created = (await bankAccountRepository.create({ name: 'Checking', type: 'checking' }, tenantId));
    expect(created).toMatchObject({ name: 'Checking', type: 'checking', current_balance: 0 });
    (await expect((await bankAccountRepository.findById(created.id))).toEqual(created));
  });

  it('current_balance can be set on create', async () => {
    const created = (await bankAccountRepository.create({ name: 'Savings', type: 'savings', current_balance: 500 }, tenantId));
    expect(created.current_balance).toBe(500);
  });

  it('findAll scopes to the given tenant', async () => {
    const otherTenantId = (await db.run("INSERT INTO tenants (name, type) VALUES ('Other', 'personal')"))
      .lastInsertRowid as number;
    (await bankAccountRepository.create({ name: 'Checking', type: 'checking' }, tenantId));
    (await bankAccountRepository.create({ name: 'Other Checking', type: 'checking' }, otherTenantId));

    const rows = (await bankAccountRepository.findAll(tenantId));
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Checking');
  });

  it('update changes name, type, and current_balance', async () => {
    const created = (await bankAccountRepository.create({ name: 'Checking', type: 'checking' }, tenantId));
    const updated = (await bankAccountRepository.update(created.id, { name: 'Main Checking', type: 'checking', current_balance: 1200 }));
    expect(updated).toMatchObject({ id: created.id, name: 'Main Checking', current_balance: 1200 });
  });

  it('update preserves current_balance when omitted, instead of resetting it to 0', async () => {
    const created = (await bankAccountRepository.create({ name: 'Checking', type: 'checking', current_balance: 1500 }, tenantId));
    const updated = (await bankAccountRepository.update(created.id, { name: 'Main Checking', type: 'checking' }));
    expect(updated.current_balance).toBe(1500);
  });

  it('institution can be set on create and preserved on an unrelated update', async () => {
    const created = (await bankAccountRepository.create({ name: 'Checking', type: 'checking', institution: 'Chase' }, tenantId));
    expect(created.institution).toBe('Chase');

    const updated = (await bankAccountRepository.update(created.id, { name: 'Main Checking', type: 'checking' }));
    expect(updated.institution).toBe('Chase');
  });

  it('an explicit null institution on update clears a previously-set one', async () => {
    const created = (await bankAccountRepository.create({ name: 'Checking', type: 'checking', institution: 'Chase' }, tenantId));
    const updated = (await bankAccountRepository.update(created.id, { name: 'Checking', type: 'checking', institution: null }));
    expect(updated.institution).toBeNull();
  });

  it('a blank/whitespace institution normalizes to null on create', async () => {
    const created = (await bankAccountRepository.create({ name: 'Checking', type: 'checking', institution: '   ' }, tenantId));
    expect(created.institution).toBeNull();
  });

  it('a blank/whitespace institution on update normalizes to null instead of storing an empty string', async () => {
    const created = (await bankAccountRepository.create({ name: 'Checking', type: 'checking', institution: 'Chase' }, tenantId));
    const updated = (await bankAccountRepository.update(created.id, { name: 'Checking', type: 'checking', institution: '' }));
    expect(updated.institution).toBeNull();
  });

  it('a surrounding-whitespace institution is trimmed on create and update', async () => {
    const created = (await bankAccountRepository.create({ name: 'Checking', type: 'checking', institution: '  Chase  ' }, tenantId));
    expect(created.institution).toBe('Chase');

    const updated = (await bankAccountRepository.update(created.id, { name: 'Checking', type: 'checking', institution: '  Ally  ' }));
    expect(updated.institution).toBe('Ally');
  });

  it('remove deletes the account', async () => {
    const created = (await bankAccountRepository.create({ name: 'Checking', type: 'checking' }, tenantId));
    (await bankAccountRepository.remove(created.id));
    (await expect((await bankAccountRepository.findById(created.id))).toBeUndefined());
  });

  it('countPaycheckSplitsFor / countSavingsGoalsFor reflect dependents', async () => {
    const account = (await bankAccountRepository.create({ name: 'Checking', type: 'checking' }, tenantId));
    (await expect((await bankAccountRepository.countPaycheckSplitsFor(account.id))).toBe(0));
    (await expect((await bankAccountRepository.countSavingsGoalsFor(account.id))).toBe(0));

    const paycheckId = (await db.run('INSERT INTO paychecks (tenant_id, label, amount, frequency, next_pay_date) VALUES (?, ?, ?, ?, ?)', tenantId, 'Job', 2000, 'biweekly', '2026-09-01')).lastInsertRowid as number;
    (await db.run('INSERT INTO paycheck_splits (paycheck_id, bank_account_id, split_type, value) VALUES (?, ?, ?, ?)', paycheckId, account.id, 'fixed', 500));
    (await expect((await bankAccountRepository.countPaycheckSplitsFor(account.id))).toBe(1));

    (await db.run('INSERT INTO savings_goals (tenant_id, name, target_amount, bank_account_id) VALUES (?, ?, ?, ?)', tenantId, 'Emergency Fund', 5000, account.id));
    (await expect((await bankAccountRepository.countSavingsGoalsFor(account.id))).toBe(1));
  });
});
