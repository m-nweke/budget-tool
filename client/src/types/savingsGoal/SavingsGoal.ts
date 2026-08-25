// Mirrors server/src/types/savingsGoal/SavingsGoal.ts
export interface SavingsGoal {
  id: number;
  tenant_id: number;
  name: string;
  target_amount: number;
  start_on: string;
  target_date: string | null;
  bank_account_id: number | null;
  saved_amount: number;
}
