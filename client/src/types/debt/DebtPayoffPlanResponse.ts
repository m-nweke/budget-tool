// Mirrors server/src/types/debt/DebtPayoffPlanResponse.ts
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
  // capped horizon, not an actual payoff.
  did_not_converge: boolean;
  per_debt: {
    debt_id: number;
    name: string;
    interest_paid: number;
    payoff_date: string | null;
  }[];
}

export interface InsufficientMinimums {
  insufficient_minimums: true;
  sum_minimums: number;
}

export interface AvalancheComparison {
  total_interest: number;
  savings: number;
}

export interface DebtPayoffPlanResponse {
  snapshot: DebtSnapshot | null;
  settings: DebtPayoffSettings | null;
  plan: DebtPayoffResult | InsufficientMinimums | null;
  avalanche_comparison: AvalancheComparison | null;
  total_balance_across_accounts: number;
}
