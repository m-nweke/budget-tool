export interface Transaction {
  id: number;
  amount: number;
  date: string;
  description: string | null;
  category_id: number;
  recurring_transaction_id: number | null;
  // Server-computed from the category's approval_threshold at creation
  // time, never client input — see CreateTransactionDto.
  needs_approval: boolean;
  approved: boolean;
  // Null for transactions materialized by generateDue() — there's no live
  // user behind a scheduled recurring occurrence.
  created_by: number | null;
}
