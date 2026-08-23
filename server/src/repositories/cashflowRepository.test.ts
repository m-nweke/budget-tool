import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import db from '../db';
import bankAccountRepository from './bankAccountRepository';
import paycheckRepository from './paycheckRepository';
import debtRepository from './debtRepository';
import recurringTransactionRepository from './recurringTransactionRepository';
import categoryRepository from './categoryRepository';
import cashflowRepository from './cashflowRepository';

let tenantId: number;

beforeEach(() => {
  db.exec(
    'DELETE FROM transactions; DELETE FROM recurring_transactions; DELETE FROM categories; ' +
      'DELETE FROM paycheck_splits; DELETE FROM paychecks; DELETE FROM debts; DELETE FROM savings_goals; ' +
      'DELETE FROM bank_accounts; DELETE FROM tenants;'
  );
  tenantId = db.prepare("INSERT INTO tenants (name, type) VALUES ('Pat''s Budget', 'personal')").run()
    .lastInsertRowid as number;
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-19T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('cashflowRepository.simulate', () => {
  it("an account's daily balance only reflects its own paycheck splits, never another account's", () => {
    const checking = bankAccountRepository.create({ name: 'Checking', type: 'checking', current_balance: 1000 }, tenantId);
    const savings = bankAccountRepository.create({ name: 'Savings', type: 'savings', current_balance: 500 }, tenantId);
    paycheckRepository.create(
      {
        label: 'Job',
        amount: 2000,
        frequency: 'weekly',
        next_pay_date: '2026-08-21',
        splits: [
          { bank_account_id: checking.id, split_type: 'fixed', value: 1500 },
          { bank_account_id: savings.id, split_type: 'percentage', value: 10 },
        ],
      },
      tenantId
    );

    const projection = cashflowRepository.simulate(tenantId, '2026-08-19', '2026-08-25');

    const checkingProjection = projection.accounts.find((a) => a.bank_account_id === checking.id)!;
    const savingsProjection = projection.accounts.find((a) => a.bank_account_id === savings.id)!;

    // Before the paycheck lands, balances stay at their starting point.
    expect(checkingProjection.daily.find((d) => d.date === '2026-08-20')!.balance).toBe(1000);
    expect(savingsProjection.daily.find((d) => d.date === '2026-08-20')!.balance).toBe(500);

    // On 2026-08-21, each account only picks up its own split.
    expect(checkingProjection.daily.find((d) => d.date === '2026-08-21')!.balance).toBe(1000 + 1500);
    expect(savingsProjection.daily.find((d) => d.date === '2026-08-21')!.balance).toBe(500 + 200);

    // The credit carries forward on later days (running balance).
    expect(checkingProjection.daily.find((d) => d.date === '2026-08-25')!.balance).toBe(1000 + 1500);
  });

  it('recurring transactions and debts appear as unattributed outflows, never mutating an account balance', () => {
    const account = bankAccountRepository.create({ name: 'Checking', type: 'checking', current_balance: 1000 }, tenantId);
    const category = categoryRepository.create({ name: 'Rent', budgeted_amount: 1200, department_id: null }, tenantId);
    recurringTransactionRepository.create({
      amount: 1200,
      description: 'Rent',
      category_id: category.id,
      start_date: '2026-08-01',
      interval: 'monthly',
    });
    recurringTransactionRepository.generateDue();
    debtRepository.create(
      { name: 'Credit Card', balance: 500, interest_rate: 20, minimum_payment: 75, due_day: 22 },
      tenantId
    );

    const projection = cashflowRepository.simulate(tenantId, '2026-08-19', '2026-09-10');

    expect(projection.outflows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: '2026-09-01', source: 'recurring_transaction', amount: 1200 }),
        expect.objectContaining({ date: '2026-08-22', source: 'debt', amount: 75 }),
      ])
    );
    // Untouched by either outflow — the account has no paychecks in this test.
    const accountProjection = projection.accounts.find((a) => a.bank_account_id === account.id)!;
    expect(accountProjection.daily.every((d) => d.balance === 1000)).toBe(true);
  });

  it('outflows are sorted by date', () => {
    bankAccountRepository.create({ name: 'Checking', type: 'checking' }, tenantId);
    debtRepository.create(
      { name: 'Late Debt', balance: 100, interest_rate: 10, minimum_payment: 20, due_day: 28 },
      tenantId
    );
    debtRepository.create(
      { name: 'Early Debt', balance: 100, interest_rate: 10, minimum_payment: 20, due_day: 20 },
      tenantId
    );

    const projection = cashflowRepository.simulate(tenantId, '2026-08-19', '2026-08-31');

    expect(projection.outflows.map((o) => o.label)).toEqual(['Early Debt', 'Late Debt']);
  });
});
