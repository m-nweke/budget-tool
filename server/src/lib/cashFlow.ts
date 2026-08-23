import bankAccountRepository from '../repositories/bankAccountRepository';
import paycheckRepository from '../repositories/paycheckRepository';
import debtRepository from '../repositories/debtRepository';
import recurringTransactionRepository from '../repositories/recurringTransactionRepository';
import { addByInterval, addOneMonth, todayISO } from '../utils/dateUtils';
import type { PaycheckFrequency, Paycheck, Debt, RecurringTransaction } from '../types';

export interface CashFlowEvent {
  date: string;
  type: 'paycheck' | 'debt_payment' | 'recurring_transaction';
  amount: number;
  description: string;
  account_id: number | null;
  account_name: string | null;
}

export interface CashFlowSnapshot {
  date: string;
  total_balance: number;
}

export interface CashFlowResult {
  start_date: string;
  end_date: string;
  accounts: Array<{ id: number; name: string; type: string; current_balance: number }>;
  events: CashFlowEvent[];
  snapshots: CashFlowSnapshot[];
  projected_end_balance: number;
  total_income: number;
  total_expenses: number;
}

function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// Advances a semimonthly date to its next occurrence.
// If the day is 1–15, the next pay is day+15 in the same month.
// If the day is 16–31, the next pay is (day-15) in the following month.
// e.g. Aug 1 → Aug 16 → Sep 1; Aug 15 → Aug 30 → Sep 15.
function advanceSemimonthly(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (day <= 15) {
    return new Date(Date.UTC(year, month - 1, day + 15)).toISOString().slice(0, 10);
  }
  return new Date(Date.UTC(year, month - 1 + 1, day - 15)).toISOString().slice(0, 10);
}

function advanceByFrequency(dateStr: string, frequency: PaycheckFrequency): string {
  switch (frequency) {
    case 'weekly': return addDays(dateStr, 7);
    case 'biweekly': return addDays(dateStr, 14);
    case 'semimonthly': return advanceSemimonthly(dateStr);
    case 'monthly': return addOneMonth(dateStr);
  }
}

function splitAmount(paycheck: Paycheck, splitIndex: number): number {
  const split = paycheck.splits[splitIndex];
  return split.split_type === 'percentage'
    ? (paycheck.amount * split.value) / 100
    : split.value;
}

function paycheckEvents(
  paychecks: Paycheck[],
  startDate: string,
  endDate: string,
  accountNames: Map<number, string>
): CashFlowEvent[] {
  const events: CashFlowEvent[] = [];

  for (const paycheck of paychecks) {
    let current = paycheck.next_pay_date;
    while (current < startDate) current = advanceByFrequency(current, paycheck.frequency);

    while (current <= endDate) {
      if (paycheck.splits.length === 0) {
        events.push({
          date: current,
          type: 'paycheck',
          amount: paycheck.amount,
          description: paycheck.label,
          account_id: null,
          account_name: null,
        });
      } else {
        for (let i = 0; i < paycheck.splits.length; i++) {
          const split = paycheck.splits[i];
          events.push({
            date: current,
            type: 'paycheck',
            amount: splitAmount(paycheck, i),
            description: paycheck.label,
            account_id: split.bank_account_id,
            account_name: accountNames.get(split.bank_account_id) ?? null,
          });
        }
      }
      current = advanceByFrequency(current, paycheck.frequency);
    }
  }

  return events;
}

function debtPaymentEvents(debts: Debt[], startDate: string, endDate: string): CashFlowEvent[] {
  const events: CashFlowEvent[] = [];
  const [sy, sm] = startDate.split('-').map(Number);
  const [ey, em] = endDate.split('-').map(Number);

  for (const debt of debts) {
    let year = sy;
    let month = sm;

    while (year < ey || (year === ey && month <= em)) {
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const day = Math.min(debt.due_day, daysInMonth);
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      if (dateStr >= startDate && dateStr <= endDate) {
        events.push({
          date: dateStr,
          type: 'debt_payment',
          amount: -debt.minimum_payment,
          description: `${debt.name} payment`,
          account_id: null,
          account_name: null,
        });
      }

      month++;
      if (month > 12) { month = 1; year++; }
    }
  }

  return events;
}

function recurringTransactionEvents(
  templates: RecurringTransaction[],
  startDate: string,
  endDate: string
): CashFlowEvent[] {
  const events: CashFlowEvent[] = [];

  for (const template of templates) {
    if (!template.active) continue;

    let current = template.next_run_date;
    while (current < startDate) current = addByInterval(current, template.interval);

    while (current <= endDate) {
      if (template.end_date && current > template.end_date) break;
      events.push({
        date: current,
        type: 'recurring_transaction',
        amount: -template.amount,
        description: template.description ?? 'Recurring transaction',
        account_id: null,
        account_name: null,
      });
      current = addByInterval(current, template.interval);
    }
  }

  return events;
}

export function simulateCashFlow(tenantId: number, months: number): CashFlowResult {
  const startDate = todayISO();
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const endDate = new Date(Date.UTC(sy, sm - 1 + months, sd)).toISOString().slice(0, 10);

  const accounts = bankAccountRepository.findAll(tenantId);
  const paychecks = paycheckRepository.findAll(tenantId);
  const debts = debtRepository.findAll(tenantId);
  const recurringTemplates = recurringTransactionRepository.findAllActive(undefined, tenantId);

  const accountNames = new Map<number, string>(accounts.map((a) => [a.id, a.name]));

  const allEvents: CashFlowEvent[] = [
    ...paycheckEvents(paychecks, startDate, endDate, accountNames),
    ...debtPaymentEvents(debts, startDate, endDate),
    ...recurringTransactionEvents(recurringTemplates, startDate, endDate),
  ];

  allEvents.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return b.amount - a.amount;
  });

  const currentTotal = accounts.reduce((sum, a) => sum + (a.current_balance ?? 0), 0);

  const snapshots: CashFlowSnapshot[] = [{ date: startDate, total_balance: currentTotal }];
  let runningBalance = currentTotal;
  let i = 0;

  while (i < allEvents.length) {
    const date = allEvents[i].date;
    let dayTotal = 0;
    while (i < allEvents.length && allEvents[i].date === date) {
      dayTotal += allEvents[i].amount;
      i++;
    }
    runningBalance += dayTotal;
    snapshots.push({ date, total_balance: runningBalance });
  }

  const totalIncome = allEvents.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const totalExpenses = allEvents.filter((e) => e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0);

  return {
    start_date: startDate,
    end_date: endDate,
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      current_balance: a.current_balance ?? 0,
    })),
    events: allEvents,
    snapshots,
    projected_end_balance: runningBalance,
    total_income: totalIncome,
    total_expenses: totalExpenses,
  };
}
