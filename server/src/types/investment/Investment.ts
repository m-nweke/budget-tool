export type InvestmentType = 'brokerage' | 'retirement' | 'crypto' | 'other';

export interface Investment {
  id: number;
  tenant_id: number;
  name: string;
  type: InvestmentType;
  // Manually updated by the owner, same convention as
  // savings_goals.saved_amount — not derived from any live feed.
  current_value: number;
  // A matched-optional pair (both null or both set) — when set,
  // cashflowRepository folds this into the simulation as a recurring
  // outflow, same shape as debts.promo_apr/promo_expires_on.
  monthly_contribution: number | null;
  contribution_day: number | null;
  // Which account funds the contribution — optional, informational only
  // (see bills.bank_account_id for the same shape).
  bank_account_id: number | null;
  active: number;
}
