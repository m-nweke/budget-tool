export type PayoffStrategy = 'snowball' | 'avalanche' | 'custom';

export interface DebtPayoffSettings {
  id: number;
  tenant_id: number;
  monthly_amount: number;
  strategy: PayoffStrategy;
  // JSON-encoded array of debt ids, in payoff order — only meaningful when
  // strategy is 'custom'. Parsed by debtPayoffPlanRepository, not stored
  // pre-parsed, since a raw row is what the repository layer deals in.
  custom_order: string | null;
}
