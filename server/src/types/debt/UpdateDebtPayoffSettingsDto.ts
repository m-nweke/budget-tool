import type { PayoffStrategy } from './DebtPayoffSettings';

export interface UpdateDebtPayoffSettingsDto {
  monthly_amount: number;
  strategy: PayoffStrategy;
  // Required (and used) only when strategy === 'custom' — an array of debt
  // ids in payoff order.
  order?: number[];
}
