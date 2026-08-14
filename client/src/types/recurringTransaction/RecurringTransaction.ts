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

export interface CreateRecurringTransactionDto {
  amount: number;
  description?: string | null;
  category_id: number;
  interval: Interval;
  start_date: string;
  end_date?: string | null;
}

export interface UpdateRecurringTransactionDto {
  amount?: number;
  description?: string | null;
  category_id?: number;
  interval?: Interval;
  end_date?: string | null;
  apply_to_existing?: boolean;
}
