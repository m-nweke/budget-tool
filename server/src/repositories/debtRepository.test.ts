import { describe, it, expect, beforeEach } from 'vitest';
import db from '../db';
import debtRepository from './debtRepository';

let tenantId: number;

beforeEach(async () => {
  (await db.exec('DELETE FROM debts; DELETE FROM tenants;'));
  tenantId = (await db.run("INSERT INTO tenants (name, type) VALUES ('Pat''s Budget', 'personal')"))
    .lastInsertRowid as number;
});

describe('debtRepository', () => {
  it('creates and finds a debt', async () => {
    const created = (await debtRepository.create(
      { name: 'Credit Card', balance: 2000, interest_rate: 19.99, minimum_payment: 50, due_day: 15 },
      tenantId
    ));
    expect(created).toMatchObject({ name: 'Credit Card', balance: 2000, due_day: 15 });
    (await expect((await debtRepository.findById(created.id))).toEqual(created));
  });

  it('findAll scopes to the given tenant', async () => {
    const otherTenantId = (await db.run("INSERT INTO tenants (name, type) VALUES ('Other', 'personal')"))
      .lastInsertRowid as number;
    (await debtRepository.create({ name: 'Credit Card', balance: 2000, interest_rate: 19.99, minimum_payment: 50, due_day: 15 }, tenantId));
    (await debtRepository.create({ name: 'Student Loan', balance: 10000, interest_rate: 5, minimum_payment: 200, due_day: 1 }, otherTenantId));

    const rows = (await debtRepository.findAll(tenantId));
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Credit Card');
  });

  it('update changes balance and minimum_payment', async () => {
    const created = (await debtRepository.create(
      { name: 'Credit Card', balance: 2000, interest_rate: 19.99, minimum_payment: 50, due_day: 15 },
      tenantId
    ));
    const updated = (await debtRepository.update(created.id, {
      name: 'Credit Card',
      balance: 1800,
      interest_rate: 19.99,
      minimum_payment: 60,
      due_day: 15,
    }));
    expect(updated).toMatchObject({ balance: 1800, minimum_payment: 60 });
  });

  it('creates and updates a promo-APR debt', async () => {
    const created = (await debtRepository.create(
      {
        name: 'Promo Card',
        balance: 1000,
        interest_rate: 24.99,
        minimum_payment: 25,
        due_day: 10,
        promo_apr: 0,
        promo_expires_on: '2027-01-01',
      },
      tenantId
    ));
    expect(created).toMatchObject({ promo_apr: 0, promo_expires_on: '2027-01-01' });

    const updated = (await debtRepository.update(created.id, {
      name: 'Promo Card',
      balance: 1000,
      interest_rate: 24.99,
      minimum_payment: 25,
      due_day: 10,
      promo_apr: null,
      promo_expires_on: null,
    }));
    expect(updated).toMatchObject({ promo_apr: null, promo_expires_on: null });
  });

  it('defaults promo fields to null when omitted', async () => {
    const created = (await debtRepository.create(
      { name: 'Credit Card', balance: 2000, interest_rate: 19.99, minimum_payment: 50, due_day: 15 },
      tenantId
    ));
    expect(created).toMatchObject({ promo_apr: null, promo_expires_on: null });
  });

  it('remove deletes the debt', async () => {
    const created = (await debtRepository.create(
      { name: 'Credit Card', balance: 2000, interest_rate: 19.99, minimum_payment: 50, due_day: 15 },
      tenantId
    ));
    (await debtRepository.remove(created.id));
    (await expect((await debtRepository.findById(created.id))).toBeUndefined());
  });
});
