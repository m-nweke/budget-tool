import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import db from '../db';
import bankAccountRepository from './bankAccountRepository';
import paycheckRepository from './paycheckRepository';
import debtRepository from './debtRepository';
import billRepository from './billRepository';
import investmentRepository from './investmentRepository';
import recurringTransactionRepository from './recurringTransactionRepository';
import categoryRepository from './categoryRepository';
import cashflowRepository from './cashflowRepository';

let tenantId: number;

beforeEach(() => {
  db.exec(
    'DELETE FROM transactions; DELETE FROM recurring_transactions; DELETE FROM categories; ' +
      'DELETE FROM paycheck_splits; DELETE FROM paychecks; DELETE FROM debts; DELETE FROM bills; ' +
      'DELETE FROM investments; DELETE FROM savings_goals; DELETE FROM bank_accounts; DELETE FROM tenants;'
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

  it('recurring transactions, debts, and bills appear as unattributed outflows, never mutating an account balance', () => {
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
    billRepository.create({ name: 'Electric', category: 'electric', amount: 90, due_day: 25 }, tenantId);
    // Inactive bills are excluded from the simulation entirely.
    billRepository.create({ name: 'Old Gym', category: 'other', amount: 40, due_day: 1, active: false }, tenantId);

    const projection = cashflowRepository.simulate(tenantId, '2026-08-19', '2026-09-10');

    expect(projection.outflows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: '2026-09-01', source: 'recurring_transaction', amount: 1200 }),
        expect.objectContaining({ date: '2026-08-22', source: 'debt', amount: 75 }),
        expect.objectContaining({ date: '2026-08-25', source: 'bill', amount: 90, label: 'Electric' }),
      ])
    );
    expect(projection.outflows.some((o) => o.label === 'Old Gym')).toBe(false);
    // Untouched by either outflow — the account has no paychecks in this test.
    const accountProjection = projection.accounts.find((a) => a.bank_account_id === account.id)!;
    expect(accountProjection.daily.every((d) => d.balance === 1000)).toBe(true);
  });

  it("a bill's occurrences are bounded by its start_on/end_date window", () => {
    bankAccountRepository.create({ name: 'Checking', type: 'checking' }, tenantId);
    // Hasn't started yet — its 2026-08-25 occurrence falls before start_on.
    billRepository.create(
      { name: 'Future Gym', category: 'other', amount: 40, due_day: 25, start_on: '2026-09-01' },
      tenantId
    );
    // Ended before its 2026-08-25 occurrence.
    billRepository.create(
      { name: 'Cancelled Streaming', category: 'other', amount: 15, due_day: 25, end_date: '2026-08-01' },
      tenantId
    );
    // Active for the whole window.
    billRepository.create({ name: 'Electric', category: 'electric', amount: 90, due_day: 25 }, tenantId);

    const projection = cashflowRepository.simulate(tenantId, '2026-08-19', '2026-09-10');

    expect(projection.outflows.some((o) => o.label === 'Future Gym')).toBe(false);
    expect(projection.outflows.some((o) => o.label === 'Cancelled Streaming')).toBe(false);
    expect(projection.outflows.some((o) => o.label === 'Electric')).toBe(true);
  });

  it("an investment's recurring contribution appears as an unattributed outflow, but a manually-tracked one (no contribution) doesn't", () => {
    bankAccountRepository.create({ name: 'Checking', type: 'checking' }, tenantId);
    investmentRepository.create(
      { name: 'Vanguard', type: 'brokerage', monthly_contribution: 200, contribution_day: 25 },
      tenantId
    );
    // No monthly_contribution/contribution_day — purely tracked value, never
    // projected as an outflow.
    investmentRepository.create({ name: '401k', type: 'retirement', current_value: 40000 }, tenantId);
    // Inactive — excluded even though it has a contribution configured.
    const inactive = investmentRepository.create(
      { name: 'Old Fund', type: 'other', monthly_contribution: 50, contribution_day: 25 },
      tenantId
    );
    investmentRepository.update(inactive.id, {
      name: 'Old Fund',
      type: 'other',
      monthly_contribution: 50,
      contribution_day: 25,
      active: false,
    });

    const projection = cashflowRepository.simulate(tenantId, '2026-08-19', '2026-09-10');

    expect(projection.outflows).toEqual(
      expect.arrayContaining([expect.objectContaining({ date: '2026-08-25', source: 'investment', amount: 200, label: 'Vanguard' })])
    );
    expect(projection.outflows.some((o) => o.label === '401k')).toBe(false);
    expect(projection.outflows.some((o) => o.label === 'Old Fund')).toBe(false);
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
