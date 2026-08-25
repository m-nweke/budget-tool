import debtRepository from './debtRepository';
import debtPayoffSettingsRepository from './debtPayoffSettingsRepository';
import bankAccountRepository from './bankAccountRepository';
import { addOneMonth, todayISO, stepMonthlyDueDates } from '../utils/dateUtils';
import type {
  Debt,
  PayoffStrategy,
  DebtSnapshot,
  DebtPayoffResult,
  InsufficientMinimums,
  DebtPayoffPlanResponse,
} from '../types';

// Safety valve against a pathological input (e.g. monthly_amount barely
// above the sum of minimums against a high-interest balance) looping
// effectively forever — 50 years is far past any plan this feature is
// meant to represent as achievable.
const MAX_MONTHS = 600;

function effectiveMonthlyRate(debt: Debt, currentDate: string): number {
  if (debt.promo_apr !== null && debt.promo_expires_on !== null && currentDate < debt.promo_expires_on) {
    return debt.promo_apr / 100 / 12;
  }
  return debt.interest_rate / 100 / 12;
}

// snowball (default): smallest balance first — psychologically motivating
// quick wins, the industry-standard "snowball" method.
// avalanche: highest interest rate first — mathematically minimizes total
// interest paid among any fixed-order strategy.
// custom: the caller's own order, with two self-healing fallbacks so a
// stale settings row never breaks the simulation: an id that no longer
// belongs to this tenant (the debt was deleted) is silently dropped, and
// any debt not present in the array (added after the order was set) is
// appended at the end, smallest balance first.
function orderDebts(debts: Debt[], strategy: PayoffStrategy, customOrder: number[] | null): Debt[] {
  if (strategy === 'avalanche') {
    return [...debts].sort((a, b) => b.interest_rate - a.interest_rate);
  }
  if (strategy === 'custom' && customOrder) {
    const byId = new Map(debts.map((d) => [d.id, d]));
    const ordered = customOrder.map((id) => byId.get(id)).filter((d): d is Debt => d !== undefined);
    const orderedIds = new Set(ordered.map((d) => d.id));
    const remaining = debts.filter((d) => !orderedIds.has(d.id)).sort((a, b) => a.balance - b.balance);
    return [...ordered, ...remaining];
  }
  return [...debts].sort((a, b) => a.balance - b.balance);
}

// Month-by-month amortization: accrue interest at each debt's current
// effective rate (promo or regular, depending on where currentDate falls),
// apply every debt's minimum_payment, then apply whatever's left of the
// monthly amount to the first debt with a balance in `order`, spilling
// over to the next once one is paid off. A plain loop rather than
// closed-form math — same "just loop it, correctness by inspection over
// premature optimization" convention as cashflowRepository's date-stepping
// (decision 19), and this loop is bounded by MAX_MONTHS regardless.
function simulate(debts: Debt[], monthlyAmount: number, order: Debt[]): DebtPayoffResult | InsufficientMinimums {
  const sumMinimums = debts.reduce((sum, d) => sum + d.minimum_payment, 0);
  if (monthlyAmount < sumMinimums) {
    return { insufficient_minimums: true, sum_minimums: sumMinimums };
  }
  const extra = monthlyAmount - sumMinimums;

  const balances = new Map(debts.map((d) => [d.id, d.balance]));
  const interestPaid = new Map(debts.map((d) => [d.id, 0]));
  const payoffDate = new Map<number, string>();

  let currentDate = todayISO();
  let months = 0;
  while ([...balances.values()].some((b) => b > 0) && months < MAX_MONTHS) {
    months++;
    currentDate = addOneMonth(currentDate);

    for (const debt of debts) {
      const balance = balances.get(debt.id)!;
      if (balance <= 0) continue;
      const interest = balance * effectiveMonthlyRate(debt, currentDate);
      interestPaid.set(debt.id, interestPaid.get(debt.id)! + interest);
      balances.set(debt.id, balance + interest);
    }

    for (const debt of debts) {
      const balance = balances.get(debt.id)!;
      if (balance <= 0) continue;
      balances.set(debt.id, balance - Math.min(debt.minimum_payment, balance));
    }

    let remainingExtra = extra;
    for (const debt of order) {
      if (remainingExtra <= 0) break;
      const balance = balances.get(debt.id)!;
      if (balance <= 0) continue;
      const payment = Math.min(remainingExtra, balance);
      balances.set(debt.id, balance - payment);
      remainingExtra -= payment;
    }

    for (const debt of debts) {
      if (balances.get(debt.id)! <= 0 && !payoffDate.has(debt.id)) {
        payoffDate.set(debt.id, currentDate);
      }
    }
  }

  const totalInterest = [...interestPaid.values()].reduce((sum, v) => sum + v, 0);
  return {
    months,
    total_interest: totalInterest,
    debt_free_date: currentDate,
    per_debt: debts.map((d) => ({
      debt_id: d.id,
      name: d.name,
      interest_paid: interestPaid.get(d.id)!,
      payoff_date: payoffDate.get(d.id) ?? null,
    })),
  };
}

function buildSnapshot(debts: Debt[]): DebtSnapshot | null {
  if (debts.length === 0) return null;
  const highestInterest = [...debts].sort((a, b) => b.interest_rate - a.interest_rate)[0];
  const lowestBalance = [...debts].sort((a, b) => a.balance - b.balance)[0];
  // A 2-month window always contains at least one occurrence of any
  // due_day (1-31), even if today happens to be past this month's.
  const from = todayISO();
  const windowEnd = addOneMonth(addOneMonth(from));
  const soonestDue = [...debts]
    .map((debt) => ({ debt, nextDue: stepMonthlyDueDates(debt.due_day, from, windowEnd)[0] }))
    .sort((a, b) => (a.nextDue < b.nextDue ? -1 : a.nextDue > b.nextDue ? 1 : 0))[0];

  return {
    highest_interest: { debt_id: highestInterest.id, name: highestInterest.name, interest_rate: highestInterest.interest_rate },
    lowest_balance: { debt_id: lowestBalance.id, name: lowestBalance.name, balance: lowestBalance.balance },
    soonest_due: { debt_id: soonestDue.debt.id, name: soonestDue.debt.name, due_date: soonestDue.nextDue },
  };
}

const debtPayoffPlanRepository = {
  buildPlan(tenantId: number): DebtPayoffPlanResponse {
    const debts = debtRepository.findAll(tenantId);
    const settings = debtPayoffSettingsRepository.find(tenantId) ?? null;
    const totalBalanceAcrossAccounts = bankAccountRepository
      .findAll(tenantId)
      .reduce((sum, account) => sum + account.current_balance, 0);

    const snapshot = buildSnapshot(debts);

    let plan: DebtPayoffResult | InsufficientMinimums | null = null;
    let avalancheComparison: DebtPayoffPlanResponse['avalanche_comparison'] = null;

    if (settings && settings.monthly_amount > 0 && debts.length > 0) {
      const customOrder = (() => { if (!settings.custom_order) return null; try { return JSON.parse(settings.custom_order) as number[]; } catch { return null; } })();
      const order = orderDebts(debts, settings.strategy, customOrder);
      plan = simulate(debts, settings.monthly_amount, order);

      if (settings.strategy !== 'avalanche' && !('insufficient_minimums' in plan)) {
        const avalancheOrder = orderDebts(debts, 'avalanche', null);
        const avalanchePlan = simulate(debts, settings.monthly_amount, avalancheOrder);
        if (!('insufficient_minimums' in avalanchePlan)) {
          avalancheComparison = {
            total_interest: avalanchePlan.total_interest,
            savings: plan.total_interest - avalanchePlan.total_interest,
          };
        }
      }
    }

    return {
      snapshot,
      settings,
      plan,
      avalanche_comparison: avalancheComparison,
      total_balance_across_accounts: totalBalanceAcrossAccounts,
    };
  },
};

export default debtPayoffPlanRepository;
