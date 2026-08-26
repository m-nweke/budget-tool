import type { PayoffStrategy } from './DebtPayoffSettings';

export interface UpdateDebtPayoffSettingsDto {
  monthly_amount: number;
  strategy: PayoffStrategy;
  order?: number[];
}
