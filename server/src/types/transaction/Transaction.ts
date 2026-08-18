export interface Transaction {
  id: number;
  amount: number;
  date: string;
  description: string | null;
  category_id: number;
  recurring_transaction_id: number | null;
  // Server-computed from the category's approval_threshold — never client
  // input (see CreateTransactionDto). Recomputed on update too whenever
  // amount or category_id actually changes, not just fixed at creation.
  needs_approval: boolean;
  approved: boolean;
  // Null for transactions materialized by generateDue() — there's no live
  // user behind a scheduled recurring occurrence.
  created_by: number | null;
}
