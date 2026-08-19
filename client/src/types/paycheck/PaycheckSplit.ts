// Mirrors server/src/types/paycheck/PaycheckSplit.ts
export type SplitType = 'percentage' | 'fixed';

export interface PaycheckSplit {
  id: number;
  paycheck_id: number;
  bank_account_id: number;
  split_type: SplitType;
  value: number;
}
