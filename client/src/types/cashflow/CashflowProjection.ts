// Mirrors server/src/types/cashflow/CashflowProjection.ts
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
  starting_balance: number;
  daily: AccountDailyBalance[];
}

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
