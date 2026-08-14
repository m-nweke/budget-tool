import type { RecurrenceInterval } from './RecurrenceInterval';

export interface UpdateRecurringTransactionDto {
  amount: number;
  description?: string | null;
  category_id: number;
  interval: RecurrenceInterval;
  end_date?: string | null;
  // When true, also applies amount/description/category_id to every
  // transaction already generated from this template (not just future
  // occurrences). Dates on those rows are left untouched.
  apply_to_existing?: boolean;
}
