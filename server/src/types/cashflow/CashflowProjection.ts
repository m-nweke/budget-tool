import type { BankAccountType } from '../bankAccount';

// A credit landing in one account on one day — currently only paychecks,
// since paycheck_splits is the only inflow with a real bank_account_id
// (recurring transactions/debts have no account link — see ProjectedOutflow).
export interface PaycheckCredit {
  paycheck_id: number;
  label: string;
  amount: number;
}

export interface AccountDailyBalance {
  date: string;
  balance: number;
  credits: PaycheckCredit[];
}

export interface AccountProjection {
  bank_account_id: number;
  name: string;
  type: BankAccountType;
  starting_balance: number;
  daily: AccountDailyBalance[];
}

// Recurring transactions, debt minimum payments, and bills have no
// bank_account_id (transactions were never wired to accounts — see story
// 18's decision doc), so they can't be attributed to any one account's
// balance. Surfaced instead as a tenant-wide, unattributed list of
// expected outflows.
export interface ProjectedOutflow {
  date: string;
  source: 'recurring_transaction' | 'debt' | 'bill';
  id: number;
  label: string;
  amount: number;
}

export interface CashflowProjection {
  from: string;
  to: string;
  accounts: AccountProjection[];
  outflows: ProjectedOutflow[];
}
