// Mirrors server/src/types/investment/Investment.ts
export type InvestmentType = 'brokerage' | 'retirement' | 'crypto' | 'other';

export interface Investment {
  id: number;
  tenant_id: number;
  name: string;
  type: InvestmentType;
  current_value: number;
  monthly_contribution: number | null;
  contribution_day: number | null;
  bank_account_id: number | null;
  active: number;
}
