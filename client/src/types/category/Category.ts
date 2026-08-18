export interface Category {
  id: number;
  name: string;
  budgeted_amount: number;
  start_on: string;
  department_id: number | null;
  approval_threshold: number | null;
}
