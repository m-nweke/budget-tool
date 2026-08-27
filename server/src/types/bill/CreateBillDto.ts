import type { BillCategory } from './Bill';

export interface CreateBillDto {
  name: string;
  category: BillCategory;
  amount: number;
  due_day: number;
  active?: boolean;
  bank_account_id?: number | null;
  start_on?: string;
  end_date?: string | null;
}
