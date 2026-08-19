export type SplitType = 'percentage' | 'fixed';

export interface PaycheckSplit {
  id: number;
  paycheck_id: number;
  bank_account_id: number;
  split_type: SplitType;
  // A percentage (0-100) when split_type='percentage', a dollar amount
  // when split_type='fixed'. Splits don't have to sum to 100%/the full
  // paycheck amount — an unallocated remainder is allowed.
  value: number;
}
