export type AccountType = 'checking' | 'savings' | 'cash' | 'credit_card' | 'investment' | 'other';
export type Frequency = 'once' | 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
export interface FinanceAccount { id: number; name: string; type: AccountType; opening_balance_cents: number; opening_on: string; balance_cents: number; spendable: boolean }
export interface Movement { id?: number; date: string; kind: 'income' | 'expense' | 'transfer'; amount_cents: number; account_id: number; transfer_account_id?: number | null; description?: string; category_id?: number | null; commitment_key?: string | null }
export interface Commitment { key: string; name: string; kind: 'income' | 'bill' | 'debt' | 'savings' | 'investment' | 'expense'; amount_cents: number; account_id: number | null; transfer_account_id?: number | null; frequency: Frequency; next_date: string; end_date?: string | null; active?: boolean; day_of_month?: number; pay_days?: number[] }
export interface FinanceGoal { id: number; name: string; target_cents: number; saved_cents: number; account_id: number | null; target_date: string | null }
export interface FinanceSettings { timezone: string; cushion_cents: number; essential_allowance_cents: number; spending_account_ids: number[] }
export interface FinanceData { as_of: string; accounts: FinanceAccount[]; movements: Movement[]; commitments: Commitment[]; goals: FinanceGoal[]; settings: FinanceSettings; warnings: string[] }
export interface ScenarioEvent { date: string; account_id: number; amount_cents: number; description?: string }
export interface Forecast { from: string; to: string; daily: { date: string; balance_cents: number; headroom_cents: number; accounts: Record<number, number> }[]; safe_to_spend_cents: number | null; headroom_cents: number | null; next_income_date: string | null; window_end: string; warnings: string[] }
