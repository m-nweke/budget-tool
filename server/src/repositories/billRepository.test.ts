import { describe, it, expect, beforeEach } from 'vitest';
import db from '../db';
import billRepository from './billRepository';

let tenantId: number;

beforeEach(() => {
  db.exec('DELETE FROM bills; DELETE FROM bank_accounts; DELETE FROM tenants;');
  tenantId = db.prepare("INSERT INTO tenants (name, type) VALUES ('Pat''s Budget', 'personal')").run()
    .lastInsertRowid as number;
});

describe('billRepository', () => {
  it('creates and finds a bill, defaulting active to true', () => {
    const created = billRepository.create({ name: 'Rent', category: 'rent', amount: 1500, due_day: 1 }, tenantId);
    expect(created).toMatchObject({ name: 'Rent', category: 'rent', amount: 1500, due_day: 1, active: 1 });
    expect(billRepository.findById(created.id)).toEqual(created);
  });

  it('findAll scopes to the given tenant', () => {
    const otherTenantId = db.prepare("INSERT INTO tenants (name, type) VALUES ('Other', 'personal')").run()
      .lastInsertRowid as number;
    billRepository.create({ name: 'Rent', category: 'rent', amount: 1500, due_day: 1 }, tenantId);
    billRepository.create({ name: 'Electric', category: 'electric', amount: 80, due_day: 10 }, otherTenantId);

    const rows = billRepository.findAll(tenantId);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Rent');
  });

  it('findAllActive excludes an inactive bill', () => {
    billRepository.create({ name: 'Rent', category: 'rent', amount: 1500, due_day: 1 }, tenantId);
    const cancelled = billRepository.create(
      { name: 'Old Insurance', category: 'insurance', amount: 40, due_day: 5 },
      tenantId
    );
    billRepository.update(cancelled.id, {
      name: 'Old Insurance',
      category: 'insurance',
      amount: 40,
      due_day: 5,
      active: false,
    });

    const active = billRepository.findAllActive(tenantId);
    expect(active).toHaveLength(1);
    expect(active[0].name).toBe('Rent');
  });

  it('update changes amount and due_day', () => {
    const created = billRepository.create({ name: 'Wifi', category: 'wifi', amount: 60, due_day: 20 }, tenantId);
    const updated = billRepository.update(created.id, {
      name: 'Wifi',
      category: 'wifi',
      amount: 65,
      due_day: 22,
    });
    expect(updated).toMatchObject({ amount: 65, due_day: 22 });
  });

  it('remove deletes the bill', () => {
    const created = billRepository.create({ name: 'Water', category: 'water', amount: 30, due_day: 12 }, tenantId);
    billRepository.remove(created.id);
    expect(billRepository.findById(created.id)).toBeUndefined();
  });

  it('defaults start_on to today and bank_account_id/end_date to null when omitted', () => {
    const created = billRepository.create({ name: 'Rent', category: 'rent', amount: 1500, due_day: 1 }, tenantId);
    expect(created.bank_account_id).toBeNull();
    expect(created.end_date).toBeNull();
    expect(created.start_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('stores an explicit bank_account_id, start_on, and end_date', () => {
    db.exec('DELETE FROM bank_accounts;');
    const accountId = db
      .prepare("INSERT INTO bank_accounts (tenant_id, name, type, current_balance) VALUES (?, 'Checking', 'checking', 0)")
      .run(tenantId).lastInsertRowid as number;

    const created = billRepository.create(
      {
        name: 'Rent',
        category: 'rent',
        amount: 1500,
        due_day: 1,
        bank_account_id: accountId,
        start_on: '2026-01-01',
        end_date: '2026-12-01',
      },
      tenantId
    );
    expect(created).toMatchObject({ bank_account_id: accountId, start_on: '2026-01-01', end_date: '2026-12-01' });
  });

  it('update leaves bank_account_id/end_date untouched when omitted, but clears them on explicit null', () => {
    db.exec('DELETE FROM bank_accounts;');
    const accountId = db
      .prepare("INSERT INTO bank_accounts (tenant_id, name, type, current_balance) VALUES (?, 'Checking', 'checking', 0)")
      .run(tenantId).lastInsertRowid as number;
    const created = billRepository.create(
      { name: 'Rent', category: 'rent', amount: 1500, due_day: 1, bank_account_id: accountId, end_date: '2026-12-01' },
      tenantId
    );

    const untouched = billRepository.update(created.id, { name: 'Rent', category: 'rent', amount: 1500, due_day: 1 });
    expect(untouched).toMatchObject({ bank_account_id: accountId, end_date: '2026-12-01' });

    const cleared = billRepository.update(created.id, {
      name: 'Rent',
      category: 'rent',
      amount: 1500,
      due_day: 1,
      bank_account_id: null,
      end_date: null,
    });
    expect(cleared).toMatchObject({ bank_account_id: null, end_date: null });
  });
});
