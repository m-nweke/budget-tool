import type { InvestmentType } from './Investment';

export interface CreateInvestmentDto {
  name: string;
  type: InvestmentType;
  current_value?: number;
  monthly_contribution?: number | null;
  contribution_day?: number | null;
  bank_account_id?: number | null;
  active?: boolean;
}
