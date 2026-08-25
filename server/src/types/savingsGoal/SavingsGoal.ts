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
  // How much has actually been set aside toward this goal, tracked
  // independently of the linked account's balance (SoFi-vault style: a
  // vault's own balance, not the whole parent account) — see decision 20.
  saved_amount: number;
}
