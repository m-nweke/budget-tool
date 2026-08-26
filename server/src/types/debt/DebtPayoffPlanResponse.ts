import type { DebtPayoffSettings } from './DebtPayoffSettings';

export interface DebtSnapshot {
  highest_interest: { debt_id: number; name: string; interest_rate: number };
  lowest_balance: { debt_id: number; name: string; balance: number };
  soonest_due: { debt_id: number; name: string; due_date: string };
}

export interface DebtPayoffResult {
  months: number;
  total_interest: number;
  debt_free_date: string;
  // True when the simulation hit its MAX_MONTHS safety cap with at least one
  // debt still unpaid — debt_free_date and total_interest reflect the
  // capped horizon, not an actual payoff, so callers must not present them
  // as a solved plan (see per_debt's null payoff_date for which debt(s)
  // never clear).
  did_not_converge: boolean;
  per_debt: {
    debt_id: number;
    name: string;
    interest_paid: number;
    payoff_date: string | null;
  }[];
}

// Returned instead of DebtPayoffResult when monthly_amount can't even cover
// every debt's minimum_payment — there's no meaningful order/simulation to
// run until that's fixed, so the two shapes are mutually exclusive.
export interface InsufficientMinimums {
  insufficient_minimums: true;
  sum_minimums: number;
}

export interface AvalancheComparison {
  total_interest: number;
  // total_interest of the currently selected strategy's plan minus this
  // avalanche plan's total_interest — positive means avalanche saves money.
  savings: number;
}

export interface DebtPayoffPlanResponse {
  snapshot: DebtSnapshot | null;
  settings: DebtPayoffSettings | null;
  plan: DebtPayoffResult | InsufficientMinimums | null;
  avalanche_comparison: AvalancheComparison | null;
  total_balance_across_accounts: number;
}
