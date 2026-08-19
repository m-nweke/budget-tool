import type { SplitType } from './PaycheckSplit';

export interface CreatePaycheckSplitDto {
  bank_account_id: number;
  split_type: SplitType;
  value: number;
}
