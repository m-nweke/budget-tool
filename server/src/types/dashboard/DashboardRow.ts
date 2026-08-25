export interface DashboardRow {
  category_id: number;
  name: string;
  budgeted_amount: number;
  actual_spend: number;
  difference: number;
  // Null for a personal tenant's categories — same nullability convention
  // as Category.department_id, since there are no departments to belong to.
  department_id: number | null;
  department_name: string | null;
}
