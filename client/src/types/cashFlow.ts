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
