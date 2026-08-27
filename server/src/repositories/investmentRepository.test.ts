import { describe, it, expect, beforeEach } from 'vitest';
import db from '../db';
import investmentRepository from './investmentRepository';

let tenantId: number;

beforeEach(() => {
  db.exec('DELETE FROM investments; DELETE FROM bank_accounts; DELETE FROM tenants;');
  tenantId = db.prepare("INSERT INTO tenants (name, type) VALUES ('Pat''s Budget', 'personal')").run()
    .lastInsertRowid as number;
});

describe('investmentRepository', () => {
  it('creates and finds an investment, defaulting current_value to 0 and active to true', () => {
    const created = investmentRepository.create({ name: 'Vanguard', type: 'brokerage' }, tenantId);
    expect(created).toMatchObject({
      name: 'Vanguard',
      type: 'brokerage',
      current_value: 0,
      monthly_contribution: null,
      contribution_day: null,
      bank_account_id: null,
      active: 1,
    });
    expect(investmentRepository.findById(created.id)).toEqual(created);
  });

  it('findAll scopes to the given tenant', () => {
    const otherTenantId = db.prepare("INSERT INTO tenants (name, type) VALUES ('Other', 'personal')").run()
      .lastInsertRowid as number;
    investmentRepository.create({ name: 'Vanguard', type: 'brokerage' }, tenantId);
    investmentRepository.create({ name: '401k', type: 'retirement' }, otherTenantId);

    const rows = investmentRepository.findAll(tenantId);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Vanguard');
  });

  it('findAllActive excludes an inactive investment', () => {
    investmentRepository.create({ name: 'Vanguard', type: 'brokerage' }, tenantId);
    const closed = investmentRepository.create({ name: 'Old Fund', type: 'other' }, tenantId);
    investmentRepository.update(closed.id, { name: 'Old Fund', type: 'other', active: false });

    const active = investmentRepository.findAllActive(tenantId);
    expect(active).toHaveLength(1);
    expect(active[0].name).toBe('Vanguard');
  });

  it('stores a recurring contribution and an explicit linked account', () => {
    db.exec('DELETE FROM bank_accounts;');
    const accountId = db
      .prepare("INSERT INTO bank_accounts (tenant_id, name, type, current_balance) VALUES (?, 'Checking', 'checking', 0)")
      .run(tenantId).lastInsertRowid as number;

    const created = investmentRepository.create(
      {
        name: 'Vanguard',
        type: 'brokerage',
        current_value: 5000,
        monthly_contribution: 200,
        contribution_day: 5,
        bank_account_id: accountId,
      },
      tenantId
    );
    expect(created).toMatchObject({
      current_value: 5000,
      monthly_contribution: 200,
      contribution_day: 5,
      bank_account_id: accountId,
    });
  });

  it('update leaves bank_account_id/monthly_contribution untouched when omitted, but clears them on explicit null', () => {
    db.exec('DELETE FROM bank_accounts;');
    const accountId = db
      .prepare("INSERT INTO bank_accounts (tenant_id, name, type, current_balance) VALUES (?, 'Checking', 'checking', 0)")
      .run(tenantId).lastInsertRowid as number;
    const created = investmentRepository.create(
      { name: 'Vanguard', type: 'brokerage', monthly_contribution: 200, contribution_day: 5, bank_account_id: accountId },
      tenantId
    );

    const untouched = investmentRepository.update(created.id, { name: 'Vanguard', type: 'brokerage' });
    expect(untouched).toMatchObject({ monthly_contribution: 200, contribution_day: 5, bank_account_id: accountId });

    const cleared = investmentRepository.update(created.id, {
      name: 'Vanguard',
      type: 'brokerage',
      monthly_contribution: null,
      contribution_day: null,
      bank_account_id: null,
    });
    expect(cleared).toMatchObject({ monthly_contribution: null, contribution_day: null, bank_account_id: null });
  });

  it('remove deletes the investment', () => {
    const created = investmentRepository.create({ name: 'Vanguard', type: 'brokerage' }, tenantId);
    investmentRepository.remove(created.id);
    expect(investmentRepository.findById(created.id)).toBeUndefined();
  });
});
