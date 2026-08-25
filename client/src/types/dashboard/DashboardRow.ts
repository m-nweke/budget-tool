export interface DashboardRow {
  category_id: number;
  name: string;
  budgeted_amount: number;
  actual_spend: number;
  difference: number;
  department_id: number | null;
  department_name: string | null;
}
