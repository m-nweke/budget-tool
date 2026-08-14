export interface Transaction {
  id: number;
  amount: number;
  date: string;
  description: string | null;
  category_id: number;
  needs_approval: number;
  approved: number;
  created_by: number | null;
  recurring_transaction_id: number | null;
}

export interface CreateTransactionDto {
  amount: number;
  date: string;
  description?: string | null;
  category_id: number;
}

export interface UpdateTransactionDto {
  amount?: number;
  date?: string;
  description?: string | null;
  category_id?: number;
}
