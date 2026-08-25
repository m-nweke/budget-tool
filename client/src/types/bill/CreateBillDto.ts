import type { BillCategory } from './Bill';

export interface CreateBillDto {
  name: string;
  category: BillCategory;
  amount: number;
  due_day: number;
  active?: boolean;
}
