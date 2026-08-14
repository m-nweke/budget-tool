export interface CreateTransactionDto {
  amount: number;
  date: string;
  description?: string | null;
  category_id: number;
}
