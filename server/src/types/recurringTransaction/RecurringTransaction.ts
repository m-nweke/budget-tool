export interface RecurringTransaction {
  id: number;
  amount: number;
  description: string | null;
  category_id: number;
  interval: 'monthly';
  next_run_date: string;
  active: number;
}
