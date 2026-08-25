export interface CreateSavingsGoalDto {
  name: string;
  target_amount: number;
  start_on?: string;
  target_date?: string | null;
  bank_account_id?: number | null;
  saved_amount?: number;
}
