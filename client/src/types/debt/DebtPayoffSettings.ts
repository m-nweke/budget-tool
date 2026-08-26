// Mirrors server/src/types/debt/DebtPayoffSettings.ts
export type PayoffStrategy = 'snowball' | 'avalanche' | 'custom';

export interface DebtPayoffSettings {
  id: number;
  tenant_id: number;
  monthly_amount: number;
  strategy: PayoffStrategy;
  custom_order: string | null;
}
