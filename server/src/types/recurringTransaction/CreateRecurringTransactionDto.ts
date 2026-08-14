import type { RecurrenceInterval } from './RecurrenceInterval';

export interface CreateRecurringTransactionDto {
  amount: number;
  description?: string | null;
  category_id: number;
  start_date: string;
  interval: RecurrenceInterval;
  end_date?: string | null;
}
