export interface CreateRecurringTransactionDto {
  amount: number;
  description?: string | null;
  category_id: number;
  start_date: string;
}
