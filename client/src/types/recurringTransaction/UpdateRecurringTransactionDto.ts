import type { RecurrenceInterval } from './RecurrenceInterval';

export interface UpdateRecurringTransactionDto {
  amount: number;
  description?: string | null;
  category_id: number;
  interval: RecurrenceInterval;
  end_date?: string | null;
  apply_to_existing?: boolean;
}
