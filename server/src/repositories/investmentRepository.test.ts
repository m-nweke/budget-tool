import { describe, it, expect, beforeEach } from 'vitest';
import db from '../db';
import investmentRepository from './investmentRepository';

let tenantId: number;

beforeEach(async () => {
  (await db.exec('DELETE FROM investments; DELETE FROM bank_accounts; DELETE FROM tenants;'));
  tenantId = (await db.run("INSERT INTO tenants (name, type) VALUES ('Pat''s Budget', 'personal')"))
    .lastInsertRowid as number;
});

describe('investmentRepository', () => {
  it('creates and finds an investment, defaulting current_value to 0 and active to true', async () => {
    const created = (await investmentRepository.create({ name: 'Vanguard', type: 'brokerage' }, tenantId));
    expect(created).toMatchObject({
      name: 'Vanguard',
      type: 'brokerage',
      current_value: 0,
      monthly_contribution: null,
      contribution_day: null,
      bank_account_id: null,
      active: 1,
    });
    (await expect((await investmentRepository.findById(created.id))).toEqual(created));
  });

  it('findAll scopes to the given tenant', async () => {
    const otherTenantId = (await db.run("INSERT INTO tenants (name, type) VALUES ('Other', 'personal')"))
      .lastInsertRowid as number;
    (await investmentRepository.create({ name: 'Vanguard', type: 'brokerage' }, tenantId));
    (await investmentRepository.create({ name: '401k', type: 'retirement' }, otherTenantId));

    const rows = (await investmentRepository.findAll(tenantId));
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Vanguard');
  });

  it('findAllActive excludes an inactive investment', async () => {
    (await investmentRepository.create({ name: 'Vanguard', type: 'brokerage' }, tenantId));
    const closed = (await investmentRepository.create({ name: 'Old Fund', type: 'other' }, tenantId));
    (await investmentRepository.update(closed.id, { name: 'Old Fund', type: 'other', active: false }));

    const active = (await investmentRepository.findAllActive(tenantId));
    expect(active).toHaveLength(1);
    expect(active[0].name).toBe('Vanguard');
  });

  it('stores a recurring contribution and an explicit linked account', async () => {
    (await db.exec('DELETE FROM bank_accounts;'));
    const accountId = (await db.run("INSERT INTO bank_accounts (tenant_id, name, type, current_balance) VALUES (?, 'Checking', 'checking', 0)", tenantId)).lastInsertRowid as number;

    const created = (await investmentRepository.create(
      {
        name: 'Vanguard',
        type: 'brokerage',
        current_value: 5000,
        monthly_contribution: 200,
        contribution_day: 5,
        bank_account_id: accountId,
      },
      tenantId
    ));
    expect(created).toMatchObject({
      current_value: 5000,
      monthly_contribution: 200,
      contribution_day: 5,
      bank_account_id: accountId,
    });
  });

  it('update leaves bank_account_id/monthly_contribution untouched when omitted, but clears them on explicit null', async () => {
    (await db.exec('DELETE FROM bank_accounts;'));
    const accountId = (await db.run("INSERT INTO bank_accounts (tenant_id, name, type, current_balance) VALUES (?, 'Checking', 'checking', 0)", tenantId)).lastInsertRowid as number;
    const created = (await investmentRepository.create(
      { name: 'Vanguard', type: 'brokerage', monthly_contribution: 200, contribution_day: 5, bank_account_id: accountId },
      tenantId
    ));

    const untouched = (await investmentRepository.update(created.id, { name: 'Vanguard', type: 'brokerage' }));
    expect(untouched).toMatchObject({ monthly_contribution: 200, contribution_day: 5, bank_account_id: accountId });

    const cleared = (await investmentRepository.update(created.id, {
      name: 'Vanguard',
      type: 'brokerage',
      monthly_contribution: null,
      contribution_day: null,
      bank_account_id: null,
    }));
    expect(cleared).toMatchObject({ monthly_contribution: null, contribution_day: null, bank_account_id: null });
  });

  it('remove deletes the investment', async () => {
    const created = (await investmentRepository.create({ name: 'Vanguard', type: 'brokerage' }, tenantId));
    (await investmentRepository.remove(created.id));
    (await expect((await investmentRepository.findById(created.id))).toBeUndefined());
  });
});
