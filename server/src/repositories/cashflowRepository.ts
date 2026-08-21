import bankAccountRepository from './bankAccountRepository';
import paycheckRepository from './paycheckRepository';
import recurringTransactionRepository from './recurringTransactionRepository';
import debtRepository from './debtRepository';
import { addDays, stepPaycheckDates, stepMonthlyDueDates } from '../utils/dateUtils';
import type {
  CashflowProjection,
  AccountProjection,
  AccountDailyBalance,
  PaycheckCredit,
  ProjectedOutflow,
} from '../types';

function dateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  let current = from;
  while (current <= to) {
    dates.push(current);
    current = addDays(current, 1);
  }
  return dates;
}

// Cross-cutting read-only aggregator, not a single-table repository — same
// precedent as recurringTransactionRepository importing categoryRepository/
// transactionRepository (decision 13). No DB writes anywhere in this file.
const cashflowRepository = {
  simulate(tenantId: number, from: string, to: string): CashflowProjection {
    const dates = dateRange(from, to);

    // Each account's balance only ever moves from its own paycheck splits —
    // the one inflow with a real bank_account_id. Recurring transactions and
    // debt payments have no account link (transactions were never wired to
    // accounts — story 18's decision doc), so they're collected separately
    // below instead of guessed onto an arbitrary account.
    //
    // Computed once, outside the account loop: paychecks/splits don't
    // depend on which account is being projected, so fetching them (and
    // stepping their occurrence dates) per account was redundant DB work
    // that scaled with account count for no reason.
    const creditsByAccount = new Map<number, (PaycheckCredit & { date: string })[]>();
    for (const paycheck of paycheckRepository.findAll(tenantId)) {
      const occurrenceDates = stepPaycheckDates(paycheck.next_pay_date, paycheck.frequency, from, to);
      for (const split of paycheck.splits) {
        const amount = split.split_type === 'percentage' ? (paycheck.amount * split.value) / 100 : split.value;
        const existing = creditsByAccount.get(split.bank_account_id) ?? [];
        for (const date of occurrenceDates) {
          existing.push({ paycheck_id: paycheck.id, label: paycheck.label, amount, date });
        }
        creditsByAccount.set(split.bank_account_id, existing);
      }
    }

    const accounts: AccountProjection[] = bankAccountRepository.findAll(tenantId).map((account) => {
      const daily: AccountDailyBalance[] = dates.map((date) => ({ date, balance: account.current_balance, credits: [] }));
      const balanceByIndex = new Map(dates.map((date, index) => [date, index]));

      for (const { date, ...credit } of creditsByAccount.get(account.id) ?? []) {
        const index = balanceByIndex.get(date);
        if (index === undefined) continue;
        daily[index].credits.push(credit);
      }

      // A credit applies from the day it lands onward, not just that one
      // day — the running balance carries forward same as a real account.
      let running = account.current_balance;
      for (const day of daily) {
        running += day.credits.reduce((sum, credit) => sum + credit.amount, 0);
        day.balance = running;
      }

      return {
        bank_account_id: account.id,
        name: account.name,
        starting_balance: account.current_balance,
        daily,
      };
    });

    const outflows: ProjectedOutflow[] = [];

    for (const template of recurringTransactionRepository.findAllActive(undefined, tenantId)) {
      for (const occurrence of recurringTransactionRepository.projectOccurrences(template, to)) {
        if (occurrence.date < from) continue;
        outflows.push({
          date: occurrence.date,
          source: 'recurring_transaction',
          id: template.id,
          label: template.description || 'Recurring transaction',
          amount: occurrence.amount,
        });
      }
    }

    for (const debt of debtRepository.findAll(tenantId)) {
      for (const dueDate of stepMonthlyDueDates(debt.due_day, from, to)) {
        outflows.push({
          date: dueDate,
          source: 'debt',
          id: debt.id,
          label: debt.name,
          amount: debt.minimum_payment,
        });
      }
    }

    outflows.sort((a, b) => a.date.localeCompare(b.date));

    return { from, to, accounts, outflows };
  },
};

export default cashflowRepository;
