import type { Interval } from './RecurringTransaction';

export interface UpdateRecurringTransactionDto {
  amount?: number;
  description?: string | null;
  category_id?: number;
  interval?: Interval;
  end_date?: string | null;
  // when true: delete previously-generated transactions, rewind cursor to
  // earliest one's date, regenerate from scratch under the new config
  apply_to_existing?: boolean;
}
