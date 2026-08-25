// Mirrors server/src/types/bill/Bill.ts
export type BillCategory = 'rent' | 'wifi' | 'electric' | 'water' | 'insurance' | 'other';

export interface Bill {
  id: number;
  tenant_id: number;
  name: string;
  category: BillCategory;
  amount: number;
  due_day: number;
  active: number;
}
