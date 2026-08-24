export type BillCategory = 'rent' | 'wifi' | 'electric' | 'water' | 'insurance' | 'other';

export interface Bill {
  id: number;
  tenant_id: number;
  name: string;
  category: BillCategory;
  amount: number;
  // Same 1-31 month-clamp shape as debts.due_day — see stepMonthlyDueDates.
  due_day: number;
  active: number;
}
