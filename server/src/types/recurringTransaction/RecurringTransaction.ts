export type Interval = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface RecurringTransaction {
  id: number;
  amount: number;
  description: string | null;
  category_id: number;
  interval: Interval;
  next_run_date: string;
  end_date: string | null;
  active: number;
}
