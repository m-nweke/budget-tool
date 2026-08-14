import type { RecurrenceInterval } from './RecurrenceInterval';

export interface RecurringTransaction {
  id: number;
  amount: number;
  description: string | null;
  category_id: number;
  interval: RecurrenceInterval;
  next_run_date: string;
  end_date: string | null;
  active: number;
}
