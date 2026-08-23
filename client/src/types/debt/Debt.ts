// Mirrors server/src/types/debt/Debt.ts
export interface Debt {
  id: number;
  tenant_id: number;
  name: string;
  balance: number;
  interest_rate: number;
  minimum_payment: number;
  due_day: number;
}
