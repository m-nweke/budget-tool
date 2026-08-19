import type { PaycheckSplit } from './PaycheckSplit';

// Mirrors server/src/types/paycheck/Paycheck.ts
export type PaycheckFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

export interface Paycheck {
  id: number;
  tenant_id: number;
  label: string;
  amount: number;
  frequency: PaycheckFrequency;
  next_pay_date: string;
  splits: PaycheckSplit[];
}
