import { describe, it, expect, beforeEach } from 'vitest';
import db from '../db';
import savingsGoalRepository from './savingsGoalRepository';
import bankAccountRepository from './bankAccountRepository';

let tenantId: number;

beforeEach(() => {
  db.exec('DELETE FROM savings_goals; DELETE FROM bank_accounts; DELETE FROM tenants;');
  tenantId = db.prepare("INSERT INTO tenants (name, type) VALUES ('Pat''s Budget', 'personal')").run()
    .lastInsertRowid as number;
});

describe('savingsGoalRepository', () => {
  it('creates and finds a savings goal with no linked account', () => {
    const created = savingsGoalRepository.create({ name: 'Emergency Fund', target_amount: 5000 }, tenantId);
    expect(created).toMatchObject({ name: 'Emergency Fund', target_amount: 5000, bank_account_id: null });
    expect(savingsGoalRepository.findById(created.id)).toEqual(created);
  });

  it('creates a savings goal linked to a bank account', () => {
    const account = bankAccountRepository.create({ name: 'Savings', type: 'savings' }, tenantId);
    const created = savingsGoalRepository.create(
      { name: 'Emergency Fund', target_amount: 5000, bank_account_id: account.id },
      tenantId
    );
    expect(created.bank_account_id).toBe(account.id);
  });

  it('start_on defaults to today when omitted', () => {
    const created = savingsGoalRepository.create({ name: 'Emergency Fund', target_amount: 5000 }, tenantId);
    expect(created.start_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('start_on can be explicitly backdated on create', () => {
    const created = savingsGoalRepository.create(
      { name: 'Emergency Fund', target_amount: 5000, start_on: '2026-01-01' },
      tenantId
    );
    expect(created.start_on).toBe('2026-01-01');
  });

  it('start_on is preserved on update when omitted', () => {
    const created = savingsGoalRepository.create(
      { name: 'Emergency Fund', target_amount: 5000, start_on: '2026-01-01' },
      tenantId
    );
    const updated = savingsGoalRepository.update(created.id, { name: 'Emergency Fund', target_amount: 6000 });
    expect(updated.start_on).toBe('2026-01-01');
  });

  it('findAll scopes to the given tenant', () => {
    const otherTenantId = db.prepare("INSERT INTO tenants (name, type) VALUES ('Other', 'personal')").run()
      .lastInsertRowid as number;
    savingsGoalRepository.create({ name: 'Emergency Fund', target_amount: 5000 }, tenantId);
    savingsGoalRepository.create({ name: 'Vacation', target_amount: 2000 }, otherTenantId);

    const rows = savingsGoalRepository.findAll(tenantId);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Emergency Fund');
  });

  it('update can change and clear the linked bank account', () => {
    const account = bankAccountRepository.create({ name: 'Savings', type: 'savings' }, tenantId);
    const created = savingsGoalRepository.create(
      { name: 'Emergency Fund', target_amount: 5000, bank_account_id: account.id },
      tenantId
    );
    const updated = savingsGoalRepository.update(created.id, {
      name: 'Emergency Fund',
      target_amount: 5000,
      bank_account_id: null,
    });
    expect(updated.bank_account_id).toBeNull();
  });

  it('remove deletes the goal', () => {
    const created = savingsGoalRepository.create({ name: 'Emergency Fund', target_amount: 5000 }, tenantId);
    savingsGoalRepository.remove(created.id);
    expect(savingsGoalRepository.findById(created.id)).toBeUndefined();
  });
});
