export interface Category {
  id: number;
  name: string;
  budgeted_amount: number;
  department_id: number | null;
  created_at: string;
  start_on: string;
}
