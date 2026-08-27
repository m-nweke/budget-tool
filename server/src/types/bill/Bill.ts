export type BillCategory = 'rent' | 'wifi' | 'electric' | 'water' | 'insurance' | 'other';

export interface Bill {
  id: number;
  tenant_id: number;
  name: string;
  category: BillCategory;
  amount: number;
  // Same 1-31 month-clamp shape as debts.due_day — see stepMonthlyDueDates.
  due_day: number;
  active: number;
  // Which account this bill is paid from — optional, informational only
  // (see savings_goals.bank_account_id for the same shape).
  bank_account_id: number | null;
  // When this bill starts/stops being due — cashflowRepository skips
  // occurrences outside this window, same as recurring_transactions.end_date.
  start_on: string;
  end_date: string | null;
}
