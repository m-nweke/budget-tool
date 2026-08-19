export interface SavingsGoal {
  id: number;
  tenant_id: number;
  name: string;
  target_amount: number;
  // When the goal starts counting toward its target — defaults to today,
  // same convention as categories.start_on.
  start_on: string;
  target_date: string | null;
  // Optional: a goal can exist with no linked account (purely aspirational
  // tracking) — see categories.department_id for the same nullable-FK shape.
  bank_account_id: number | null;
}
