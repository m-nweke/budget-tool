export interface Transaction {
  id: number;
  amount: number;
  date: string;
  description: string | null;
  category_id: number;
  recurring_transaction_id: number | null;
  needs_approval: boolean;
  approved: boolean;
  created_by: number | null;
}
