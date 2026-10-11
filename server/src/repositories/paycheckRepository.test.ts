import { describe, it, expect, beforeEach } from 'vitest';
import db from '../db';
import paycheckRepository from './paycheckRepository';
import bankAccountRepository from './bankAccountRepository';

let tenantId: number;
let accountA: number;
let accountB: number;

beforeEach(async () => {
  (await db.exec('DELETE FROM paycheck_splits; DELETE FROM paychecks; DELETE FROM bank_accounts; DELETE FROM tenants;'));
  tenantId = (await db.run("INSERT INTO tenants (name, type) VALUES ('Pat''s Budget', 'personal')"))
    .lastInsertRowid as number;
  accountA = (await bankAccountRepository.create({ name: 'Checking', type: 'checking' }, tenantId)).id;
  accountB = (await bankAccountRepository.create({ name: 'Savings', type: 'savings' }, tenantId)).id;
});

describe('paycheckRepository', () => {
  it('creates a paycheck with no splits', async () => {
    const created = (await paycheckRepository.create(
      { label: 'Job', amount: 2000, frequency: 'biweekly', next_pay_date: '2026-09-01', splits: [] },
      tenantId
    ));
    expect(created).toMatchObject({ label: 'Job', amount: 2000 });
    expect(created.splits).toEqual([]);
  });

  it('creates a paycheck with mixed percentage/fixed splits, not required to sum to the full amount', async () => {
    const created = (await paycheckRepository.create(
      {
        label: 'Job',
        amount: 2000,
        frequency: 'biweekly',
        next_pay_date: '2026-09-01',
        splits: [
          { bank_account_id: accountA, split_type: 'percentage', value: 50 },
          { bank_account_id: accountB, split_type: 'fixed', value: 300 },
        ],
      },
      tenantId
    ));
    expect(created.splits).toHaveLength(2);
    expect(created.splits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ bank_account_id: accountA, split_type: 'percentage', value: 50 }),
        expect.objectContaining({ bank_account_id: accountB, split_type: 'fixed', value: 300 }),
      ])
    );
  });

  it('findById returns the paycheck with its splits nested', async () => {
    const created = (await paycheckRepository.create(
      {
        label: 'Job',
        amount: 2000,
        frequency: 'biweekly',
        next_pay_date: '2026-09-01',
        splits: [{ bank_account_id: accountA, split_type: 'fixed', value: 500 }],
      },
      tenantId
    ));
    (await expect((await paycheckRepository.findById(created.id))).toEqual(created));
  });

  it('findAll scopes to the given tenant', async () => {
    const otherTenantId = (await db.run("INSERT INTO tenants (name, type) VALUES ('Other', 'personal')"))
      .lastInsertRowid as number;
    (await paycheckRepository.create({ label: 'Job', amount: 2000, frequency: 'biweekly', next_pay_date: '2026-09-01', splits: [] }, tenantId));
    (await paycheckRepository.create({ label: 'Other Job', amount: 1000, frequency: 'weekly', next_pay_date: '2026-09-01', splits: [] }, otherTenantId));

    const rows = (await paycheckRepository.findAll(tenantId));
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('Job');
  });

  it('update replaces splits wholesale — old splits gone, new ones present', async () => {
    const created = (await paycheckRepository.create(
      {
        label: 'Job',
        amount: 2000,
        frequency: 'biweekly',
        next_pay_date: '2026-09-01',
        splits: [{ bank_account_id: accountA, split_type: 'percentage', value: 100 }],
      },
      tenantId
    ));

    const updated = (await paycheckRepository.update(created.id, {
      label: 'Job',
      amount: 2200,
      frequency: 'biweekly',
      next_pay_date: '2026-09-15',
      splits: [
        { bank_account_id: accountA, split_type: 'percentage', value: 60 },
        { bank_account_id: accountB, split_type: 'percentage', value: 40 },
      ],
    }));

    expect(updated.amount).toBe(2200);
    expect(updated.splits).toHaveLength(2);
    const splitRows = (await db.all('SELECT * FROM paycheck_splits WHERE paycheck_id = ?', created.id));
    expect(splitRows).toHaveLength(2);
  });

  it('remove deletes the paycheck and its splits', async () => {
    const created = (await paycheckRepository.create(
      {
        label: 'Job',
        amount: 2000,
        frequency: 'biweekly',
        next_pay_date: '2026-09-01',
        splits: [{ bank_account_id: accountA, split_type: 'fixed', value: 500 }],
      },
      tenantId
    ));
    (await paycheckRepository.remove(created.id));
    (await expect((await paycheckRepository.findById(created.id))).toBeUndefined());
    const splitRows = (await db.all('SELECT * FROM paycheck_splits WHERE paycheck_id = ?', created.id));
    expect(splitRows).toHaveLength(0);
  });
});
