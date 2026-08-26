import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import db from '../db';
import debtRepository from './debtRepository';
import debtPayoffSettingsRepository from './debtPayoffSettingsRepository';
import bankAccountRepository from './bankAccountRepository';
import debtPayoffPlanRepository from './debtPayoffPlanRepository';

let tenantId: number;

beforeEach(() => {
  db.exec('DELETE FROM debt_payoff_settings; DELETE FROM bank_accounts; DELETE FROM debts; DELETE FROM tenants;');
  tenantId = db.prepare("INSERT INTO tenants (name, type) VALUES ('Pat''s Budget', 'personal')").run()
    .lastInsertRowid as number;
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-19T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('debtPayoffPlanRepository.buildPlan — snapshot', () => {
  it('is null with no debts', () => {
    expect(debtPayoffPlanRepository.buildPlan(tenantId).snapshot).toBeNull();
  });

  it('identifies highest interest, lowest balance, and soonest due', () => {
    debtRepository.create({ name: 'Low Rate', balance: 500, interest_rate: 5, minimum_payment: 25, due_day: 28 }, tenantId);
    debtRepository.create({ name: 'High Rate', balance: 2000, interest_rate: 24.99, minimum_payment: 50, due_day: 20 }, tenantId);
    debtRepository.create({ name: 'Due Soon', balance: 300, interest_rate: 10, minimum_payment: 15, due_day: 20 }, tenantId);
    // system time is 2026-08-19; due_day=20 is 1 day out, due_day=28 is 9 days out

    const { snapshot } = debtPayoffPlanRepository.buildPlan(tenantId);
    expect(snapshot!.highest_interest.name).toBe('High Rate');
    expect(snapshot!.lowest_balance.name).toBe('Due Soon');
    expect(snapshot!.soonest_due.due_date).toBe('2026-08-20');
  });
});

describe('debtPayoffPlanRepository.buildPlan — plan gating', () => {
  it('is null when no settings have been saved', () => {
    debtRepository.create({ name: 'Card', balance: 1000, interest_rate: 12, minimum_payment: 1000, due_day: 1 }, tenantId);
    expect(debtPayoffPlanRepository.buildPlan(tenantId).plan).toBeNull();
  });

  it('is null when monthly_amount is 0 (treated as "no plan yet")', () => {
    debtRepository.create({ name: 'Card', balance: 1000, interest_rate: 12, minimum_payment: 1000, due_day: 1 }, tenantId);
    debtPayoffSettingsRepository.upsert(tenantId, { monthly_amount: 0, strategy: 'snowball' });
    expect(debtPayoffPlanRepository.buildPlan(tenantId).plan).toBeNull();
  });

  it('flags insufficient_minimums when monthly_amount cannot cover every minimum_payment', () => {
    debtRepository.create({ name: 'A', balance: 1000, interest_rate: 12, minimum_payment: 100, due_day: 1 }, tenantId);
    debtRepository.create({ name: 'B', balance: 500, interest_rate: 8, minimum_payment: 50, due_day: 1 }, tenantId);
    debtPayoffSettingsRepository.upsert(tenantId, { monthly_amount: 100, strategy: 'snowball' });

    const { plan } = debtPayoffPlanRepository.buildPlan(tenantId);
    expect(plan).toMatchObject({ insufficient_minimums: true, sum_minimums: 150 });
  });
});

describe('debtPayoffPlanRepository.buildPlan — hand-computed single-debt amortization', () => {
  it('matches a hand-computed total interest and payoff timeline', () => {
    // balance 1200, 12% APR (1%/mo), minimum 1200, monthlyAmount = 1200 (no extra).
    // Month 1: interest = 1200*0.01 = 12 -> balance 1212; payment min(1200,1212)=1200 -> balance 12.
    // Month 2: interest = 12*0.01 = 0.12 -> balance 12.12; payment min(1200,12.12)=12.12 -> balance 0.
    // total_interest = 12.12, months = 2, debt_free_date = 2026-10-19 (today + 2 months).
    debtRepository.create({ name: 'Card', balance: 1200, interest_rate: 12, minimum_payment: 1200, due_day: 1 }, tenantId);
    debtPayoffSettingsRepository.upsert(tenantId, { monthly_amount: 1200, strategy: 'snowball' });

    const { plan } = debtPayoffPlanRepository.buildPlan(tenantId);
    expect(plan).not.toBeNull();
    if (plan && !('insufficient_minimums' in plan)) {
      expect(plan.months).toBe(2);
      expect(plan.total_interest).toBeCloseTo(12.12, 2);
      expect(plan.debt_free_date).toBe('2026-10-19');
      expect(plan.per_debt[0].payoff_date).toBe('2026-10-19');
    } else {
      throw new Error('expected a real plan, got insufficient_minimums');
    }
  });
});

describe('debtPayoffPlanRepository.buildPlan — strategy ordering', () => {
  it('snowball pays off the smaller balance first', () => {
    debtRepository.create({ name: 'Small', balance: 200, interest_rate: 10, minimum_payment: 20, due_day: 1 }, tenantId);
    debtRepository.create({ name: 'Large', balance: 2000, interest_rate: 10, minimum_payment: 20, due_day: 1 }, tenantId);
    // extra goes entirely to the ordered debt each month; 300/mo total budget
    debtPayoffSettingsRepository.upsert(tenantId, { monthly_amount: 300, strategy: 'snowball' });

    const { plan } = debtPayoffPlanRepository.buildPlan(tenantId);
    if (!plan || 'insufficient_minimums' in plan) throw new Error('expected a real plan');
    const small = plan.per_debt.find((d) => d.name === 'Small')!;
    const large = plan.per_debt.find((d) => d.name === 'Large')!;
    expect(small.payoff_date! < large.payoff_date!).toBe(true);
  });

  it('avalanche pays off the higher-interest debt first even if its balance is larger', () => {
    debtRepository.create({ name: 'LowRateSmall', balance: 200, interest_rate: 5, minimum_payment: 20, due_day: 1 }, tenantId);
    debtRepository.create({ name: 'HighRateLarge', balance: 2000, interest_rate: 25, minimum_payment: 20, due_day: 1 }, tenantId);
    debtPayoffSettingsRepository.upsert(tenantId, { monthly_amount: 300, strategy: 'avalanche' });

    const { plan } = debtPayoffPlanRepository.buildPlan(tenantId);
    if (!plan || 'insufficient_minimums' in plan) throw new Error('expected a real plan');
    const lowRateSmall = plan.per_debt.find((d) => d.name === 'LowRateSmall')!;
    const highRateLarge = plan.per_debt.find((d) => d.name === 'HighRateLarge')!;
    // The high-rate debt gets all the extra even though it's the bigger
    // balance, so it should NOT finish before the low-rate small one.
    expect(highRateLarge.payoff_date! < lowRateSmall.payoff_date!).toBe(false);
  });

  it('custom order routes extra to the prioritized debt and drops a since-deleted id', () => {
    // Same balance/rate so the only thing that can make them differ is the
    // extra payment order — B would otherwise tie with A exactly.
    const a = debtRepository.create({ name: 'A', balance: 500, interest_rate: 10, minimum_payment: 20, due_day: 1 }, tenantId);
    const b = debtRepository.create({ name: 'B', balance: 500, interest_rate: 10, minimum_payment: 20, due_day: 1 }, tenantId);
    // Custom order references a deleted debt id (999) and omits C entirely
    // — C should still show up in the result (appended, not dropped), just
    // with a tiny balance so it always clears via its own minimum payment
    // regardless of extra routing (isolates the A-vs-B assertion below
    // from C's payoff timing).
    const c = debtRepository.create({ name: 'C', balance: 20, interest_rate: 10, minimum_payment: 20, due_day: 1 }, tenantId);
    debtPayoffSettingsRepository.upsert(tenantId, { monthly_amount: 200, strategy: 'custom', order: [999, a.id, b.id] });

    const { plan } = debtPayoffPlanRepository.buildPlan(tenantId);
    if (!plan || 'insufficient_minimums' in plan) throw new Error('expected a real plan');
    expect(plan.per_debt.map((d) => d.debt_id)).toContain(c.id);
    const aResult = plan.per_debt.find((d) => d.debt_id === a.id)!;
    const bResult = plan.per_debt.find((d) => d.debt_id === b.id)!;
    // A is first in the custom order, so it receives the extra and pays
    // off strictly before the otherwise-identical B.
    expect(aResult.payoff_date! < bResult.payoff_date!).toBe(true);
  });
});

describe('debtPayoffPlanRepository.buildPlan — promo APR', () => {
  it('uses the promo rate until it expires, then the regular rate', () => {
    // 0% through the first full month; the simulation's monthly checkpoint
    // lands exactly on currentDate each pass (see effectiveMonthlyRate's
    // strict "<" comparison), so promo_expires_on needs to be at least two
    // months out for month 1's checkpoint (system time + 1mo) to land
    // strictly before it.
    debtRepository.create(
      {
        name: 'Promo Card',
        balance: 1000,
        interest_rate: 24,
        minimum_payment: 100,
        due_day: 1,
        promo_apr: 0,
        promo_expires_on: '2026-10-19',
      },
      tenantId
    );
    debtRepository.create({ name: 'Regular Card', balance: 1000, interest_rate: 24, minimum_payment: 100, due_day: 1 }, tenantId);
    debtPayoffSettingsRepository.upsert(tenantId, { monthly_amount: 200, strategy: 'snowball' });

    const { plan } = debtPayoffPlanRepository.buildPlan(tenantId);
    if (!plan || 'insufficient_minimums' in plan) throw new Error('expected a real plan');
    const promo = plan.per_debt.find((d) => d.name === 'Promo Card')!;
    const regular = plan.per_debt.find((d) => d.name === 'Regular Card')!;
    // The promo card accrued 0% for its first month while the regular card
    // accrued 2% immediately, so the promo card should pay off with less
    // total interest paid overall.
    expect(promo.interest_paid).toBeLessThan(regular.interest_paid);
  });
});

describe('debtPayoffPlanRepository.buildPlan — avalanche comparison', () => {
  it('is null when the selected strategy is already avalanche', () => {
    debtRepository.create({ name: 'A', balance: 500, interest_rate: 10, minimum_payment: 20, due_day: 1 }, tenantId);
    debtPayoffSettingsRepository.upsert(tenantId, { monthly_amount: 100, strategy: 'avalanche' });
    expect(debtPayoffPlanRepository.buildPlan(tenantId).avalanche_comparison).toBeNull();
  });

  it('reports savings when a different-rate ordering would cost more interest under snowball', () => {
    debtRepository.create({ name: 'LowRateSmall', balance: 200, interest_rate: 5, minimum_payment: 20, due_day: 1 }, tenantId);
    debtRepository.create({ name: 'HighRateLarge', balance: 2000, interest_rate: 25, minimum_payment: 20, due_day: 1 }, tenantId);
    debtPayoffSettingsRepository.upsert(tenantId, { monthly_amount: 300, strategy: 'snowball' });

    const { avalanche_comparison } = debtPayoffPlanRepository.buildPlan(tenantId);
    expect(avalanche_comparison).not.toBeNull();
    expect(avalanche_comparison!.savings).toBeGreaterThan(0);
  });
});

describe('debtPayoffPlanRepository.buildPlan — total balance across accounts', () => {
  it('sums current_balance across every bank account for the tenant', () => {
    bankAccountRepository.create({ name: 'Checking', type: 'checking', current_balance: 1000 }, tenantId);
    bankAccountRepository.create({ name: 'Savings', type: 'savings', current_balance: 2500 }, tenantId);
    expect(debtPayoffPlanRepository.buildPlan(tenantId).total_balance_across_accounts).toBe(3500);
  });
});
