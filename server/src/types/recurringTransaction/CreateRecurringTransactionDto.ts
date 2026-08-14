import type { Interval } from './RecurringTransaction';

export interface CreateRecurringTransactionDto {
  amount: number;
  description?: string | null;
  category_id: number;
  interval: Interval;
  start_date: string;
  end_date?: string | null;
}
